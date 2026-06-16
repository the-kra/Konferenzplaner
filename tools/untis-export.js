/* ============================================================================
   WebUntis Export v6 – FINAL
   ----------------------------------------------------------------------------
   Kommt OHNE getTeachers() aus (das ist für Lehrer-Accounts gesperrt).
   Die Lehrer-Infos (ID -> Kürzel + Nachname) werden direkt aus dem
   Stundenplan gesammelt, der pro Stunde liefert:
       te: [{ id, name (Kürzel), longname (Nachname) }]
   ----------------------------------------------------------------------------
   - Abteilung aus 'did' (3=Abend, 2/21=ET, 19=ME, 1/20/23=MB)
   - KV aus 'teacher1' (ID), aufgelöst über die selbstgebaute Lehrer-Tabelle
   - entfallene Stunden (code:"cancelled") werden ignoriert
   - Platzhalter-Lehrer "---" werden ignoriert
   - nur aktive Klassen mit echtem Unterricht; INCLUDE_5 steuert 5. Klassen (Default: raus)
   ----------------------------------------------------------------------------
   AUSFÜHREN: eingeloggt -> F12 -> Konsole -> einfügen -> Enter -> warten ->
              untisCSV() / untisCSVTeacher()

   Das von untisCSV() erzeugte webuntis_klassen_lehrer_kv_SS.csv lädt das
   Konferenztool direkt über "Excel/CSV laden". Spalten:
       Abteilung;Klasse;Langname;Klassenvorstand;StellvKV;Lehrer
============================================================================ */

(async () => {
  const INCLUDE_5 = false;   // true = inkl. 5. Klassen, false = nur 1.-4.
  const BASE = location.origin + "/WebUntis";
  const school = new URLSearchParams(location.search).get("school") || "htl1-klagenfurt";
  const RPC_URL = BASE + "/jsonrpc.do?school=" + encodeURIComponent(school);

  // ====== ZEITRAUM SOMMERSEMESTER (anpassen falls nötig) =====================
  const SEM_START = 20260216;
  const SEM_END = (() => { const d=new Date();
    return d.getFullYear()*10000+(d.getMonth()+1)*100+d.getDate(); })();
  // ===========================================================================

  async function rpc(method, params = {}) {
    const res = await fetch(RPC_URL, { method:"POST",
      headers:{"Content-Type":"application/json"}, credentials:"include",
      body: JSON.stringify({ id:"req", method, params, jsonrpc:"2.0" }) });
    const json = await res.json();
    if (json.error) throw new Error(method+": "+JSON.stringify(json.error));
    return json.result;
  }

  function intToDate(i){const y=Math.floor(i/10000),m=Math.floor((i%10000)/100),d=i%100;return new Date(y,m-1,d);}
  function dateToInt(dt){return dt.getFullYear()*10000+(dt.getMonth()+1)*100+dt.getDate();}
  function buildWeeks(s,e){const w=[];let c=intToDate(s);const end=intToDate(e);
    while(c<=end){const we=new Date(c);we.setDate(we.getDate()+6);
      w.push([dateToInt(c),dateToInt(we>end?end:we)]);c.setDate(c.getDate()+7);}return w;}
  const weeks = buildWeeks(SEM_START, SEM_END);

  console.log("%cWebUntis Export v6 (final) | Schule: "+school, "color:#0aa;font-weight:bold");

  // --- Abteilung: did -> Zielgruppe ------------------------------------------
  const deptRaw = await rpc("getDepartments");
  const deptName = {}; deptRaw.forEach(d=>deptName[d.id]=d.longName||d.name);
  function mapAbteilung(did){
    if (did===3) return "Abendschule";
    if (did===2||did===21) return "Elektrotechnik";
    if (did===19) return "Mechatronik";
    if (did===1||did===20||did===23) return "Maschinenbau";
    return deptName[did] || ("Abt-ID "+did);
  }

  // --- Lehrer-Tabelle wird LIVE aus den Stundenplänen aufgebaut --------------
  // teacherById: id -> { kuerzel, name }
  const teacherById = {};
  function noteTeacher(t){
    if (!t || t.id==null) return;
    const kuerzel = (t.name||"").trim();
    const name = (t.longname||t.longName||"").trim();
    if (kuerzel === "---" || kuerzel === "") return;       // Platzhalter raus
    if (!teacherById[t.id]) teacherById[t.id] = { kuerzel, name };
    else { // ergänze fehlende Felder
      if (!teacherById[t.id].name && name) teacherById[t.id].name = name;
    }
  }
  function teacherLabel(id){
    const t = teacherById[id];
    if (!t) return "ID "+id;
    return t.kuerzel + (t.name ? " ("+t.name+")" : "");
  }

  // --- Klassen (aktiv, ohne 5.) ----------------------------------------------
  const klassenRaw = await rpc("getKlassen");
  const klassen = klassenRaw.filter(k => k.active !== false && (INCLUDE_5 || !/^5/.test(k.name.trim())));
  console.log("Klassen: "+klassenRaw.length+" gesamt -> "+klassen.length+" ("+(INCLUDE_5?"aktiv, inkl. 5.":"aktiv, ohne 5.")+") | Abteilungen: "+deptRaw.length);

  // --- Scan: pro Klasse alle Wochen ------------------------------------------
  const result = {}; let idx=0;
  for (const k of klassen) {
    idx++;
    const entry = {
      klasse: k.name, langname: k.longName||"",
      abt: mapAbteilung(k.did),
      teacher1: k.teacher1 || null,   // KV-ID, später auflösen
      teacher2: k.teacher2 || null,
      lehrerIds: new Set(), aktiv:false,
    };
    for (const [ws,we] of weeks) {
      try {
        const tt = await rpc("getTimetable", { options:{
          element:{id:k.id,type:1}, startDate:ws, endDate:we,
          teacherFields:["id","name","longname"] }});
        (tt||[]).forEach(lesson=>{
          if (lesson.code === "cancelled") return;          // Entfall ignorieren
          entry.aktiv = true;
          (lesson.te||[]).forEach(t=>{ noteTeacher(t);
            if (t && t.id!=null && (t.name||"")!=="---") entry.lehrerIds.add(t.id); });
        });
      } catch(e){}
      await new Promise(r=>setTimeout(r,60));
    }
    result[k.name]=entry;
    if(idx%5===0||idx===klassen.length)
      console.log("  ...verarbeitet: "+idx+"/"+klassen.length+"  (zuletzt: "+k.name+
        " | "+entry.abt+" | "+entry.lehrerIds.size+" Lehrer)");
  }

  // --- KV jetzt auflösen (teacher1-ID -> Label) ------------------------------
  Object.values(result).forEach(e=>{
    e.kv  = e.teacher1!=null ? teacherLabel(e.teacher1) : "";
    e.kv2 = e.teacher2!=null ? teacherLabel(e.teacher2) : "";
    e.lehrer = [...e.lehrerIds].map(teacherLabel).sort((a,b)=>a.localeCompare(b));
  });

  // --- Aktive Klassen, Gruppierung -------------------------------------------
  const aktive = Object.values(result).filter(e=>e.aktiv);
  console.log("Aktive Klassen im Semester: "+aktive.length+" | erkannte Lehrer gesamt: "+Object.keys(teacherById).length);

  const byDept={}; aktive.sort((a,b)=>a.klasse.localeCompare(b.klasse))
    .forEach(e=>{(byDept[e.abt]=byDept[e.abt]||[]).push(e);});
  const order=["Mechatronik","Elektrotechnik","Maschinenbau","Abendschule"];
  const deps=Object.keys(byDept).sort((a,b)=>(order.indexOf(a)+1||99)-(order.indexOf(b)+1||99));

  console.log("%c\n=== ERGEBNIS (aktive Klassen 25/26 SS, ohne 5.) ===","color:#0a0;font-weight:bold");
  deps.forEach(dep=>{ console.log("%c\n"+dep,"color:#06c;font-weight:bold;font-size:14px");
    byDept[dep].forEach(e=>console.log("  "+e.klasse+"  [KV: "+(e.kv||"?")+"]  ("+e.lehrer.length+
      " Lehrer) -> "+e.lehrer.join(", "))); });

  // --- CSVs ------------------------------------------------------------------
  let csv="Abteilung;Klasse;Langname;Klassenvorstand;StellvKV;Lehrer\n";
  deps.forEach(dep=>byDept[dep].forEach(e=>{
    const base=`"${e.abt}";"${e.klasse}";"${e.langname}";"${e.kv}";"${e.kv2}"`;
    if(e.lehrer.length===0)csv+=base+`;""\n`; else e.lehrer.forEach(l=>csv+=base+`;"${l}"\n`); }));
  const tv={}; aktive.forEach(e=>e.lehrer.forEach(l=>(tv[l]=tv[l]||new Set()).add(e.klasse)));
  let csvT="Lehrer;Klassen;AnzahlKlassen\n";
  Object.keys(tv).sort().forEach(l=>{const kl=[...tv[l]].sort();
    csvT+=`"${l}";"${kl.join(", ")}";${kl.length}\n`;});

  function dl(name,c){const b=new Blob(["﻿"+c],{type:"text/csv;charset=utf-8"});
    const a=document.createElement("a");a.href=URL.createObjectURL(b);a.download=name;a.click();}
  window._untisData={byDept,result,aktive,deptName,teacherById,teacherView:tv,weeks};
  window.untisCSV=()=>dl("webuntis_klassen_lehrer_kv_SS.csv",csv);
  window.untisCSVTeacher=()=>dl("webuntis_lehrer_klassen_SS.csv",csvT);

  try{ window.untisCSV(); console.log("%c\n⬇ CSV wird gespeichert: webuntis_klassen_lehrer_kv_SS.csv","color:#06c;font-weight:bold"); }catch(e){ console.warn("Download fehlgeschlagen – bitte untisCSV() ausfuehren.", e); }
  console.log("%c\n✓ Fertig!","color:#0a0;font-weight:bold;font-size:14px");
  console.log("  untisCSV()         -> Abteilung -> Klasse -> KV + Lehrer");
  console.log("  untisCSVTeacher()  -> Lehrer -> Klassen");
})();
