"use server";

import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { validatePasswordStrength } from "@/lib/auth/password";
import { createSession, destroySession, getSession, parsePlatformRoles } from "@/lib/auth/session";
import { getPostLoginDestination } from "@/lib/auth/destinations";
import { recordAudit } from "@/lib/audit";
import { COUNTRIES, isCountryCode, parsePhone } from "@/lib/phone";
import { isCurrencyCode } from "@/lib/money";
import { AffiliateCodeError, attributeWorkshopToAffiliate, createAffiliateProfile, findAffiliateByCode, getAffiliateProgramSettings } from "@/lib/repos/affiliates";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { authErrorCode, phoneAuthEmail, signInWithPasswordAndMigrate, supabaseMobileAuth } from "@/lib/supabase/mobile-auth";
import { sql, sqlOne, withPgTransaction } from "@/lib/supabase/postgres";

export type FormState = { error?: string; ok?: boolean };
const slugify=(value:string)=>value.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"")||"atelier";

export async function signIn(_prev:FormState,formData:FormData):Promise<FormState>{
  const country=String(formData.get("country")??"CG");
  if(!isCountryCode(country))return{error:"Pays invalide."};
  const phone=parsePhone(String(formData.get("phone")??""),country);
  if(!phone.ok)return{error:phone.error};
  const {data,error}=await signInWithPasswordAndMigrate(phone.e164,String(formData.get("password")??""));
  if(error||!data.session){
    const mapped=error?authErrorCode(error):null;
    return{error:mapped?.message??"Numero de telephone ou mot de passe incorrect."};
  }
  await createSession(data.session.access_token,data.session.refresh_token,data.session.expires_at);
  const profile=await sqlOne<{id:string;platform_roles:string[]}>("select id,platform_roles from public.app_users where auth_user_id=$1",[data.user.id]);
  if(!profile)return{error:"Profil applicatif introuvable."};
  await recordAudit({actorUserId:profile.id,action:"auth.login",entityKind:"user",entityId:profile.id});
  redirect(await getPostLoginDestination({userId:profile.id,platformRoles:parsePlatformRoles(profile.platform_roles)}));
}

export async function signUp(_prev:FormState,formData:FormData):Promise<FormState>{
  const fullName=String(formData.get("fullName")??"").trim();
  const country=String(formData.get("country")??"CG");
  const password=String(formData.get("password")??"");
  const workshopName=String(formData.get("workshopName")??"").trim();
  const city=String(formData.get("city")??"").trim();
  const currency=String(formData.get("currency")??"");
  const planCode=String(formData.get("planCode")??"").trim();
  const affiliateCode=String(formData.get("affiliateCode")??"").trim();
  if(fullName.length<2)return{error:"Merci d'indiquer votre nom."};
  if(!isCountryCode(country))return{error:"Pays invalide."};
  if(formData.get("terms")!=="on")return{error:"Vous devez accepter les conditions pour continuer."};
  const phone=parsePhone(String(formData.get("phone")??""),country);
  if(!phone.ok)return{error:phone.error};
  const strength=validatePasswordStrength(password);if(strength)return{error:strength};
  if(workshopName.length<2)return{error:"Merci d'indiquer le nom de votre atelier."};
  if(!isCurrencyCode(currency))return{error:"Devise invalide."};
  if(await sqlOne("select id from public.app_users where phone_e164=$1",[phone.e164]))return{error:"Un compte existe deja avec ce numero."};
  const plan=await sqlOne<{id:string;trial_days:number}>(`select id,trial_days from public.plans where country_code=$1 and status='active' and is_public
    and ($2='' or code=$2) order by price_amount,version desc limit 1`,[country,planCode]);
  if(!plan)return{error:"L'offre selectionnee n'est pas disponible pour ce pays."};
  const affiliate=affiliateCode?await findAffiliateByCode(affiliateCode):null;
  if(affiliateCode&&!affiliate)return{error:"Code d'affiliation invalide ou inactif."};
  const affiliateSettings=affiliate?await getAffiliateProgramSettings():null;
  const trialDays=affiliate?affiliateSettings?.affiliate_trial_days??plan.trial_days:plan.trial_days;

  const admin=supabaseAdmin();
  const {data:created,error:createError}=await admin.auth.admin.createUser({email:phoneAuthEmail(phone.e164),password,email_confirm:true,user_metadata:{full_name:fullName,phone_e164:phone.e164}});
  if(createError||!created.user)return{error:"Impossible de creer le compte. Ce numero est peut-etre deja utilise."};
  const userId=randomUUID(),workshopId=randomUUID();
  try{
    await withPgTransaction(async client=>{
      await sql("insert into public.app_users(id,auth_user_id,full_name,phone_e164,status,platform_roles) values($1,$2,$3,$4,'active','{}')",[userId,created.user.id,fullName,phone.e164],client);
      await sql(`insert into public.workshops(id,owner_user_id,name,slug,country_code,city,phone_e164,currency,timezone,status)
        values($1,$2,$3,$4,$5,$6,$7,$8,$9,'active')`,[workshopId,userId,workshopName,`${slugify(workshopName)}-${randomUUID().slice(0,8)}`,country,city||null,phone.e164,currency,COUNTRIES[country].defaultTimezone],client);
      await sql("insert into public.memberships(workshop_id,user_id,role,can_view_money,status,joined_at) values($1,$2,'owner',true,'active',now())",[workshopId,userId],client);
      await sql(`insert into public.subscriptions(workshop_id,current_plan_id,status,trial_ends_at,current_period_end)
        values($1,$2,'trialing',current_date + ($3::int * interval '1 day'),current_date + ($3::int * interval '1 day'))`,[workshopId,plan.id,trialDays],client);
      if(affiliateCode)await attributeWorkshopToAffiliate({workshopId,referralCode:affiliateCode,createdByUserId:userId},client);
      await recordAudit({workshopId,actorUserId:userId,action:"workshop.create",entityKind:"workshop",entityId:workshopId,after:{name:workshopName,country,currency}},client);
    });
  }catch(error){
    await admin.auth.admin.deleteUser(created.user.id);
    console.error("[signup]",error);
    return{error:"La creation de l'atelier a echoue."};
  }
  const {data:login}=await supabaseMobileAuth().auth.signInWithPassword({email:phoneAuthEmail(phone.e164),password});
  if(login.session)await createSession(login.session.access_token,login.session.refresh_token,login.session.expires_at);
  redirect("/atelier");
}

export async function signUpAffiliate(_prev:FormState,formData:FormData):Promise<FormState>{
  const fullName=String(formData.get("fullName")??"").trim();
  const country=String(formData.get("country")??"CG");
  const password=String(formData.get("password")??"");
  const requestedCode=String(formData.get("requestedCode")??"").trim();
  const autoGenerate=formData.get("autoCode")==="on";
  if(fullName.length<2)return{error:"Merci d'indiquer votre nom."};
  if(!isCountryCode(country))return{error:"Pays invalide."};
  if(formData.get("terms")!=="on")return{error:"Vous devez accepter les conditions pour continuer."};
  const phone=parsePhone(String(formData.get("phone")??""),country);
  if(!phone.ok)return{error:phone.error};
  const strength=validatePasswordStrength(password);if(strength)return{error:strength};
  if(await sqlOne("select id from public.app_users where phone_e164=$1",[phone.e164]))return{error:"Un compte existe deja avec ce numero."};

  const admin=supabaseAdmin();
  const {data:created,error:createError}=await admin.auth.admin.createUser({email:phoneAuthEmail(phone.e164),password,email_confirm:true,user_metadata:{full_name:fullName,phone_e164:phone.e164,account_kind:"affiliate"}});
  if(createError||!created.user)return{error:"Impossible de creer le compte. Ce numero est peut-etre deja utilise."};
  const userId=randomUUID();
  try{
    await withPgTransaction(async client=>{
      await sql("insert into public.app_users(id,auth_user_id,full_name,phone_e164,status,platform_roles) values($1,$2,$3,$4,'active','{}')",[userId,created.user.id,fullName,phone.e164],client);
      await createAffiliateProfile({userId,displayName:fullName,phone:phone.e164,requestedCode,autoGenerate,actorUserId:userId},client);
      await recordAudit({actorUserId:userId,action:"auth.register",entityKind:"user",entityId:userId,after:{accountKind:"affiliate"}},client);
    });
  }catch(error){
    await admin.auth.admin.deleteUser(created.user.id);
    if(error instanceof AffiliateCodeError)return{error:error.message};
    console.error("[affiliate-signup]",error);
    return{error:"La creation du compte affilie a echoue."};
  }
  const {data:login}=await supabaseMobileAuth().auth.signInWithPassword({email:phoneAuthEmail(phone.e164),password});
  if(login.session)await createSession(login.session.access_token,login.session.refresh_token,login.session.expires_at);
  redirect("/affilie");
}

export async function signOut():Promise<void>{
  const session=await getSession();
  if(session)await recordAudit({actorUserId:session.user.id,action:"auth.logout",entityKind:"user",entityId:session.user.id});
  await destroySession();
  redirect("/");
}
