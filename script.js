const $ = id => document.getElementById(id);
const CLASSES = ["1ère maternelle","2ème maternelle","3ème maternelle","1ère primaire","2ème primaire","3ème primaire","4ème primaire","5ème primaire","6ème primaire","7ème EB","8ème EB","1ère secondaire","2ème secondaire","3ème secondaire","4ème secondaire"];
const DBKEY = "congoSchoolDB_v1";
const SUPABASE_URL = "https://qbrgzibhwwxfippcgntp.supabase.co";
const SUPABASE_KEY = "sb_publishable_XCiD8PorcpTSiWahJKRDGw_h-D1CzBm";
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
let cloudUser = null, cloudSaveTimer = null, cloudReady = false;
let db = {users:[], students:[], payments:[], school:{name:"CONGO SCHOOL",logo:"logo-congo-school.jpg"}, settings:{theme:"blue",currency:"FC"}};
let authMode = "login", activeUser = null;
function loadDB(){try{const saved=JSON.parse(localStorage.getItem(DBKEY));if(saved)db={...db,...saved,school:{...db.school,...saved.school},settings:{...db.settings,...saved.settings}};}catch(e){console.warn(e)}}
function saveDB(){
 localStorage.setItem(DBKEY,JSON.stringify(db));
 if(cloudUser && cloudReady){
   clearTimeout(cloudSaveTimer);
   cloudSaveTimer=setTimeout(async()=>{
     try{
       const payload={school:db.school,students:db.students,payments:db.payments,settings:db.settings};
       const {error}=await supabaseClient.from("school_data").upsert({user_id:cloudUser.id,data:payload,updated_at:new Date().toISOString()},{onConflict:"user_id"});
       if(error) throw error;
     }catch(err){console.error("Synchronisation cloud:",err);toast("Données locales enregistrées, mais synchronisation en ligne échouée. Vérifiez la configuration SQL.");}
   },500);
 }
}
function esc(s){return String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
function money(n){return new Intl.NumberFormat("fr-FR").format(Number(n)||0)+" "+db.settings.currency;}
function fullName(s){return [s.last,s.middle,s.first].filter(Boolean).join(" ");}
function dateToday(){const d=new Date();const y=d.getFullYear();const m=String(d.getMonth()+1).padStart(2,"0");const day=String(d.getDate()).padStart(2,"0");return `${y}-${m}-${day}`;}
function toast(msg){const t=$("toast");t.textContent=msg;t.classList.add("show");setTimeout(()=>t.classList.remove("show"),2800);}
function msg(id,text,error=false){$(id).textContent=text;$(id).classList.toggle("error",error);}
function setSelectOptions(id, options, placeholder="Sélectionner"){const el=$(id),old=el.value;el.innerHTML=`<option value="">${placeholder}</option>`+options.map(x=>`<option value="${esc(x)}">${esc(x)}</option>`).join("");if(options.includes(old))el.value=old;}
function init(){
 loadDB();setSelectOptions("studentClass",CLASSES);setSelectOptions("paymentClass",CLASSES);
 $("payDate").value=dateToday();$("year").textContent=new Date().getFullYear();
 document.querySelectorAll("[data-auth]").forEach(b=>b.addEventListener("click",()=>setAuthMode(b.dataset.auth)));
 $("authForm").addEventListener("submit",authSubmit);$("logoutBtn").addEventListener("click",logout);
 document.querySelectorAll(".nav-link").forEach(b=>b.addEventListener("click",()=>showPage(b.dataset.page)));
 document.querySelectorAll("[data-goto]").forEach(b=>b.addEventListener("click",()=>showPage(b.dataset.goto)));
 $("studentForm").addEventListener("submit",saveStudent);$("cancelStudentEdit").addEventListener("click",resetStudentForm);$("studentSearch").addEventListener("input",renderStudents);
 $("paymentForm").addEventListener("submit",savePayment);$("paymentClass").addEventListener("change",populatePaymentStudents);$("paymentStudent").addEventListener("change",fillPaymentStudent);$("payTotal").addEventListener("input",updateBalance);$("payAmount").addEventListener("input",updateBalance);$("resetPayment").addEventListener("click",resetPaymentForm);$("paymentSearch").addEventListener("input",renderPayments);$("clearPayments").addEventListener("click",clearPayments);
 $("schoolForm").addEventListener("submit",saveSchool);$("schoolLogoFile").addEventListener("change",uploadLogo);$("removeLogo").addEventListener("click",removeLogo);
 $("themeSelect").addEventListener("change",e=>{db.settings.theme=e.target.value;saveDB();applyTheme();});$("currencySelect").addEventListener("change",e=>{db.settings.currency=e.target.value;saveDB();renderAll();});
 $("checkStudents").addEventListener("click",checkStudents);$("refreshDate").addEventListener("click",updateDate);$("exportData").addEventListener("click",exportData);
 updateDate();setInterval(updateDate,30000);applyTheme();applySchool();
 supabaseClient.auth.getSession().then(async({data,error})=>{
   if(error||!data.session)return;
   try{cloudUser=data.session.user;activeUser=cloudUser.user_metadata?.full_name||cloudUser.email;await loadCloudData();enterApp();}
   catch(err){console.error(err);msg("authMessage",friendlyAuthError(err),true);}
 });
}
function setAuthMode(mode){
 authMode=mode;
 document.querySelectorAll("[data-auth]").forEach(b=>b.classList.toggle("active",b.dataset.auth===mode));
 $("authSubmit").textContent=mode==="login"?"Se connecter":"Créer votre compte";
 $("registerFields").classList.toggle("hidden",mode!=="register");
 ["authFullName","authPhone","authSchool"].forEach(id=>$(id).required=mode==="register");
 $("authPass").minLength=8;
 $("authPass").autocomplete=mode==="login"?"current-password":"new-password";
 $("authMessage").textContent=mode==="register"?"Créez le compte administrateur de votre école.":"";
}
async function authSubmit(e){
 e.preventDefault();
 const email=$("authUser").value.trim().toLowerCase(),password=$("authPass").value;
 const fullName=$("authFullName").value.trim(),phone=$("authPhone").value.trim(),school=$("authSchool").value.trim();
 $("authSubmit").disabled=true; $("authSubmit").textContent="Connexion en cours…";
 try{
   if(authMode==="register"){
     if(!fullName||!phone||!school) throw new Error("Remplissez le nom complet, le téléphone et le nom de l'école.");
     const {data,error}=await supabaseClient.auth.signUp({email,password,options:{data:{full_name:fullName,phone,school_name:school}}});
     if(error) throw error;
     if(!data.session){
       msg("authMessage","Compte créé. Vérifiez votre boîte e-mail pour confirmer l'adresse, puis connectez-vous.");
       return;
     }
     cloudUser=data.user;
     db={users:[],students:[],payments:[],school:{name:school,logo:"logo-congo-school.jpg"},settings:{theme:"blue",currency:"FC"}};
     await loadCloudData();
     await saveCloudNow();
     activeUser=fullName; enterApp(); toast("Compte en ligne créé avec succès.");
   }else{
     const {data,error}=await supabaseClient.auth.signInWithPassword({email,password});
     if(error) throw error;
     cloudUser=data.user; activeUser=data.user.user_metadata?.full_name||email;
     await loadCloudData();
     enterApp(); toast("Connexion réussie.");
   }
 }catch(err){msg("authMessage",friendlyAuthError(err),true);}
 finally{$("authSubmit").disabled=false;$("authSubmit").textContent=authMode==="login"?"Se connecter":"Créer votre compte";}
}
function friendlyAuthError(err){
 const m=String(err?.message||err||"Erreur inconnue");
 if(/Invalid login credentials/i.test(m))return "E-mail ou mot de passe incorrect.";
 if(/Email not confirmed/i.test(m))return "Confirmez d'abord votre adresse e-mail depuis votre boîte de réception.";
 if(/Failed to fetch|NetworkError/i.test(m))return "Connexion Internet impossible. Vérifiez Internet et la configuration Supabase.";
 if(/relation .* does not exist|school_data/i.test(m))return "La table cloud n'est pas encore installée. Exécutez le fichier SUPABASE-SETUP.sql dans SQL Editor.";
 return m;
}
async function loadCloudData(){
 cloudReady=false;
 const {data,error}=await supabaseClient.from("school_data").select("data").eq("user_id",cloudUser.id).maybeSingle();
 if(error) throw error;
 if(data?.data){
   const d=data.data;
   db={users:[],students:d.students||[],payments:d.payments||[],school:d.school||{name:"CONGO SCHOOL",logo:"logo-congo-school.jpg"},settings:d.settings||{theme:"blue",currency:"FC"}};
 }else{
   db={users:[],students:[],payments:[],school:{name:cloudUser.user_metadata?.school_name||"CONGO SCHOOL",logo:"logo-congo-school.jpg"},settings:{theme:"blue",currency:"FC"}};
   await saveCloudNow();
 }
 localStorage.setItem(DBKEY,JSON.stringify(db)); cloudReady=true;
}
async function saveCloudNow(){
 if(!cloudUser)return;
 const payload={school:db.school,students:db.students,payments:db.payments,settings:db.settings};
 const {error}=await supabaseClient.from("school_data").upsert({user_id:cloudUser.id,data:payload,updated_at:new Date().toISOString()},{onConflict:"user_id"});
 if(error)throw error;
 cloudReady=true;
}
function enterApp(){$("authScreen").classList.add("hidden");$("app").classList.remove("hidden");$("currentUser").textContent=activeUser||"Administrateur";if(!db.school.name&&db.users[0])db.school.name=db.users[0].school;applySchool();renderAll();showPage("dashboard");}
async function logout(){
 try{await supabaseClient.auth.signOut();}catch(e){console.warn(e);}
 cloudUser=null;cloudReady=false;activeUser=null;
 $("app").classList.add("hidden");$("authScreen").classList.remove("hidden");$("authForm").reset();setAuthMode("login");
}
function showPage(page){document.querySelectorAll(".page").forEach(p=>p.classList.add("hidden"));$("page-"+page).classList.remove("hidden");document.querySelectorAll(".nav-link").forEach(b=>b.classList.toggle("active",b.dataset.page===page));const titles={dashboard:"Tableau de bord",students:"Gestion des élèves",payments:"Gestion des paiements",school:"Informations de l'école",settings:"Paramètres"};$("pageTitle").textContent=titles[page];if(page==="students")renderStudents();if(page==="payments"){renderPayments();populatePaymentStudents();}}
function updateDate(){const d=new Date();$("todayText").textContent=d.toLocaleDateString("fr-FR",{weekday:"long",day:"numeric",month:"long",year:"numeric"})+" · "+d.toLocaleTimeString("fr-FR",{hour:"2-digit",minute:"2-digit"});}
function applyTheme(){document.body.classList.remove("theme-navy","theme-green");if(db.settings.theme==="navy")document.body.classList.add("theme-navy");if(db.settings.theme==="green")document.body.classList.add("theme-green");$("themeSelect").value=db.settings.theme;$("currencySelect").value=db.settings.currency;}
function applySchool(){const name=db.school.name||"CONGO SCHOOL";$("sideSchool").textContent=name;$("welcomeSchool").textContent=name;$("schoolName").value=name;const logo=db.school.logo||"logo-congo-school.jpg";["sideLogo","dashLogo","schoolLogoPreview","authLogo"].forEach(id=>$(id).src=logo);}
function saveSchool(e){e.preventDefault();db.school.name=$("schoolName").value.trim();saveDB();applySchool();renderDashboard();toast("Informations de l'école enregistrées.");}
function uploadLogo(e){const f=e.target.files[0];if(!f)return;if(!f.type.startsWith("image/"))return toast("Veuillez choisir une image.");if(f.size>1500000)return toast("Image trop lourde (maximum 1,5 Mo).");const reader=new FileReader();reader.onload=()=>{db.school.logo=reader.result;saveDB();applySchool();toast("Logo mis à jour.");};reader.readAsDataURL(f);}
function removeLogo(){db.school.logo="";saveDB();["sideLogo","dashLogo","schoolLogoPreview","authLogo"].forEach(id=>$(id).src="");toast("Logo retiré.");}
function saveStudent(e){e.preventDefault();const id=$("studentId").value;const s={id:id||("stu_"+Date.now()),last:$("studentLast").value.trim(),middle:$("studentMiddle").value.trim(),first:$("studentFirst").value.trim(),className:$("studentClass").value,option:$("studentOption").value.trim(),sex:$("studentSex").value,status:$("studentStatus").value};
 if(!s.last||!s.first||!s.className)return toast("Complétez les champs obligatoires.");if(db.students.some(x=>x.id!==id&&x.last.toLowerCase()===s.last.toLowerCase()&&x.first.toLowerCase()===s.first.toLowerCase()&&x.className===s.className))return toast("Cet élève semble déjà enregistré.");
 if(id){db.students=db.students.map(x=>x.id===id?s:x);toast("Élève modifié.");}else{db.students.push(s);toast("Élève enregistré.");}saveDB();resetStudentForm();renderAll();}
function resetStudentForm(){$("studentForm").reset();$("studentId").value="";$("saveStudentBtn").textContent="Enregistrer l'élève";}
function renderStudents(){const q=$("studentSearch").value.toLowerCase();const rows=db.students.filter(s=>[fullName(s),s.className,s.option,s.sex,s.status].join(" ").toLowerCase().includes(q));$("studentsTable").innerHTML=rows.length?rows.map(s=>`<tr><td><b>${esc(fullName(s))}</b></td><td>${esc(s.className)}</td><td>${esc(s.option||"—")}</td><td>${esc(s.sex||"—")}</td><td><span class="badge ${s.status==="Abandonné"?"abandoned":""}">${esc(s.status||"Actif")}</span></td><td><div class="action-group"><button class="mini-btn edit" data-edit-student="${s.id}">Modifier</button><button class="mini-btn delete" data-delete-student="${s.id}">Supprimer</button></div></td></tr>`).join(""):'<tr><td colspan="6" class="empty">Aucun élève trouvé.</td></tr>';
 document.querySelectorAll("[data-edit-student]").forEach(b=>b.onclick=()=>editStudent(b.dataset.editStudent));document.querySelectorAll("[data-delete-student]").forEach(b=>b.onclick=()=>deleteStudent(b.dataset.deleteStudent));}
function editStudent(id){const s=db.students.find(x=>x.id===id);if(!s)return;$("studentId").value=s.id;$("studentLast").value=s.last;$("studentMiddle").value=s.middle;$("studentFirst").value=s.first;$("studentClass").value=s.className;$("studentOption").value=s.option;$("studentSex").value=s.sex;$("studentStatus").value=s.status||"Actif";$("saveStudentBtn").textContent="Enregistrer les modifications";window.scrollTo({top:0,behavior:"smooth"});}
function deleteStudent(id){const s=db.students.find(x=>x.id===id);if(!s)return;if(!confirm("Supprimer "+fullName(s)+" ? Les paiements historiques seront conservés."))return;db.students=db.students.filter(x=>x.id!==id);saveDB();renderAll();toast("Élève supprimé.");}
function populatePaymentStudents(){const cls=$("paymentClass").value;const arr=db.students.filter(s=>s.className===cls);setSelectOptions("paymentStudent",arr.map(s=>s.id),"Sélectionner un élève");fillPaymentStudent();}
function fillPaymentStudent(){const s=db.students.find(x=>x.id===$("paymentStudent").value);$("payLast").value=s?.last||"";$("payMiddle").value=s?.middle||"";$("payFirst").value=s?.first||"";$("payOption").value=s?.option||"";const paid=s?db.payments.filter(p=>p.studentId===s.id).reduce((a,p)=>a+Number(p.amount),0):0;$("payAlready").value=paid;$("payTotal").value=s?($("payTotal").dataset.student===s.id?$("payTotal").value:""):"";$("payTotal").dataset.student=s?.id||"";updateBalance();}
function updateBalance(){const total=Number($("payTotal").value)||0,paid=Number($("payAlready").value)||0,amount=Number($("payAmount").value)||0;$("payRemaining").value=money(Math.max(0,total-paid));}
function savePayment(e){e.preventDefault();const s=db.students.find(x=>x.id===$("paymentStudent").value);if(!s)return msg("paymentMessage","Sélectionnez un élève valide.",true);const total=Number($("payTotal").value),amount=Number($("payAmount").value),already=Number($("payAlready").value)||0;if(total<=0||amount<=0)return msg("paymentMessage","Le total et le montant payé doivent être supérieurs à zéro.",true);if(amount>Math.max(0,total-already))if(!confirm("Le paiement dépasse le solde actuel. Voulez-vous continuer ?"))return;
 const p={id:"pay_"+Date.now(),studentId:s.id,studentName:fullName(s),className:s.className,option:s.option,total,amount,reason:$("payReason").value,months:$("payMonths").value.trim(),date:$("payDate").value||dateToday(),paidBefore:already,remaining:Math.max(0,total-already-amount),school:db.school.name};db.payments.push(p);saveDB();msg("paymentMessage","Paiement enregistré. Reste après paiement : "+money(p.remaining));renderAll();resetPaymentForm(false);$("paymentClass").value=s.className;populatePaymentStudents();$("paymentStudent").value=s.id;fillPaymentStudent();$("payTotal").value=total;$("payTotal").dataset.student=s.id;updateBalance();toast("Paiement enregistré avec succès.");}
function resetPaymentForm(clearClass=true){$("paymentForm").reset();$("payDate").value=dateToday();$("payAlready").value="0";$("payRemaining").value="0";if(clearClass){$("paymentStudent").innerHTML='<option value="">Sélectionner d’abord la classe</option>';}$("paymentMessage").textContent="";}
function renderPayments(){const q=$("paymentSearch").value.toLowerCase();const arr=[...db.payments].reverse().filter(p=>[p.date,p.studentName,p.className,p.reason,p.months].join(" ").toLowerCase().includes(q));$("paymentsTable").innerHTML=arr.length?arr.map(p=>`<tr><td>${esc(p.date)}</td><td><b>${esc(p.studentName)}</b></td><td>${esc(p.className)}</td><td>${esc(p.reason)}${p.months?"<br><small>"+esc(p.months)+"</small>":""}</td><td><b>${money(p.amount)}</b></td><td>${money(p.remaining)}</td><td><div class="action-group"><button class="mini-btn edit" data-receipt="${p.id}">Imprimer reçu</button><button class="mini-btn delete" data-delete-payment="${p.id}">Supprimer</button></div></td></tr>`).join(""):'<tr><td colspan="7" class="empty">Aucun paiement enregistré.</td></tr>';
 document.querySelectorAll("[data-receipt]").forEach(b=>b.onclick=()=>printReceipt(b.dataset.receipt));document.querySelectorAll("[data-delete-payment]").forEach(b=>b.onclick=()=>deletePayment(b.dataset.deletePayment));}
function deletePayment(id){if(!confirm("Supprimer ce paiement de l'historique ? Le total encaissé sera recalculé."))return;db.payments=db.payments.filter(p=>p.id!==id);saveDB();renderAll();toast("Paiement supprimé.");}
function clearPayments(){if(!db.payments.length)return toast("L'historique est déjà vide.");if(!confirm("Supprimer définitivement tous les paiements ?"))return;db.payments=[];saveDB();renderAll();toast("Historique supprimé.");}
function printReceipt(id){
 const p=db.payments.find(x=>x.id===id);if(!p)return;
 const w=window.open("","_blank","width=760,height=850");
 if(!w)return toast("Autorisez les fenêtres pop-up pour imprimer le reçu.");
 const savedLogo=db.school.logo||"logo-congo-school.jpg";
 const logoSrc=/^(data:|https?:|file:|blob:)/i.test(savedLogo)?savedLogo:new URL(savedLogo,window.location.href).href;
 const issuedAt=new Date();
 const issuedDate=issuedAt.toLocaleDateString("fr-FR",{day:"2-digit",month:"2-digit",year:"numeric"});
 const issuedTime=issuedAt.toLocaleTimeString("fr-FR",{hour:"2-digit",minute:"2-digit",second:"2-digit"});
 const schoolName=p.school||db.school.name||"CONGO SCHOOL";
 w.document.write(`<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Reçu de paiement - ${esc(schoolName)}</title><style>
 *{box-sizing:border-box}body{margin:0;padding:28px;background:#f4f6ff;color:#17213c;font-family:Arial,"Segoe UI",sans-serif}.receipt{width:100%;max-width:650px;margin:0 auto;background:#fff;border:2px solid #1010d9;border-radius:16px;padding:28px 34px;box-shadow:0 8px 24px rgba(16,16,217,.09)}.receipt-logo{text-align:center;margin:0 auto 12px}.receipt-logo img{display:block;width:112px;height:112px;object-fit:contain;margin:0 auto}.school-name{color:#1010d9;text-align:center;margin:6px 0 8px;font-size:25px}.receipt-title{text-align:center;border-bottom:2px solid #e6e8ff;padding:0 0 16px;margin:0 0 15px;font-size:20px;color:#17213c}.metadata{font-size:13px;line-height:1.8;margin:0 0 14px}.metadata b{color:#1010d9}.meta-grid{display:flex;justify-content:space-between;gap:15px;flex-wrap:wrap}.receipt table{width:100%;border-collapse:collapse;margin-top:12px}.receipt td{padding:11px 5px;border-bottom:1px solid #e9ecf5;font-size:14px;vertical-align:top}.right{text-align:right}.amount{font-size:18px;font-weight:bold;color:#1010d9}.foot{text-align:center;margin:24px 0 8px;color:#67718a;font-size:12px;line-height:1.6}.print-actions{text-align:center;margin:18px auto 0}.print-btn{border:0;border-radius:9px;padding:11px 22px;background:#1010d9;color:#fff;font-size:14px;font-weight:bold;cursor:pointer}.small-note{font-size:11px;color:#727d96}
 @page{size:auto;margin:12mm}@media print{body{padding:0;background:#fff}.receipt{max-width:none;border:1.5px solid #1010d9;border-radius:0;padding:18px 22px;box-shadow:none}.print-actions{display:none}.receipt-logo img{width:96px;height:96px}td{break-inside:avoid}.receipt{break-inside:avoid}}
 </style></head><body><main class="receipt"><div class="receipt-logo"><img src="${esc(logoSrc)}" alt="Logo de ${esc(schoolName)}"></div><h1 class="school-name">${esc(schoolName)}</h1><h2 class="receipt-title">REÇU DE PAIEMENT</h2><div class="metadata"><div class="meta-grid"><span><b>N° du reçu :</b> ${esc(p.id)}</span><span><b>Date du paiement :</b> ${esc(p.date)}</span></div><div><b>Édité le :</b> ${esc(issuedDate)} <b>à</b> ${esc(issuedTime)}</div></div><table><tr><td>Élève</td><td class="right"><b>${esc(p.studentName)}</b></td></tr><tr><td>Classe</td><td class="right">${esc(p.className)}</td></tr><tr><td>Option</td><td class="right">${esc(p.option||"—")}</td></tr><tr><td>Motif</td><td class="right">${esc(p.reason)}</td></tr><tr><td>Mois concerné(s)</td><td class="right">${esc(p.months||"—")}</td></tr><tr><td>Total attendu</td><td class="right">${money(p.total)}</td></tr><tr><td>Déjà payé avant</td><td class="right">${money(p.paidBefore)}</td></tr><tr><td><b>Montant reçu</b></td><td class="right amount">${money(p.amount)}</td></tr><tr><td><b>Reste à payer</b></td><td class="right amount">${money(p.remaining)}</td></tr></table><p class="foot">Merci pour votre paiement.<br><b>${esc(schoolName)}</b> — Gestion scolaire<br><span class="small-note">Conservez ce reçu comme preuve de paiement.</span></p><div class="print-actions"><button class="print-btn" onclick="window.print()">Imprimer le reçu</button></div></main><script>window.addEventListener('load',()=>{const img=document.querySelector('.receipt-logo img');if(img&&img.complete){return;}if(img)img.addEventListener('load',()=>{}, {once:true});});</script></body></html>`);
 w.document.close();
}
function renderDashboard(){const paid=db.payments.reduce((a,p)=>a+Number(p.amount),0);$("statStudents").textContent=db.students.length;$("statPaid").textContent=money(paid);$("statPayments").textContent=db.payments.length;$("statAbandoned").textContent=db.students.filter(s=>s.status==="Abandonné").length;
 $("classDistribution").innerHTML=CLASSES.map(c=>`<div class="class-item"><span>${esc(c)}</span><b>${db.students.filter(s=>s.className===c).length}</b></div>`).join("");
 const arr=[...db.payments].reverse().slice(0,7);$("recentPayments").innerHTML=arr.length?arr.map(p=>`<tr><td>${esc(p.date)}</td><td><b>${esc(p.studentName)}</b></td><td>${esc(p.className)}</td><td>${esc(p.reason)}</td><td><b>${money(p.amount)}</b></td></tr>`).join(""):'<tr><td colspan="5" class="empty">Aucun paiement pour le moment.</td></tr>';}
function renderAll(){renderDashboard();renderStudents();renderPayments();applySchool();}
function checkStudents(){const issues=db.students.filter(s=>!s.last||!s.first||!s.className);msg("settingsMessage",issues.length?issues.length+" élève(s) ont des informations obligatoires manquantes. Consultez la liste des élèves.":"Vérification terminée : aucun élève avec un nom, prénom ou une classe manquants.");if(issues.length)showPage("students");}
function exportData(){const blob=new Blob([JSON.stringify(db,null,2)],{type:"application/json"}),url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download="sauvegarde-congo-school-"+dateToday()+".json";a.click();URL.revokeObjectURL(url);toast("Sauvegarde téléchargée.");}
document.addEventListener("DOMContentLoaded",init);
