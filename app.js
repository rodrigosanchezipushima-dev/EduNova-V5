(() => {
  "use strict";
  const $ = s => document.querySelector(s);
  let client = null, mode = "login", user = null, activePage = "dashboard";
  let tasks = [], notes = [], schedule = [], grades = [], studyGoals = []; let timetablePeriods = [], timetableEntries = [];
  const configured = () =>
  typeof window.EDUNOVA_SUPABASE_URL === "string" &&
  window.EDUNOVA_SUPABASE_URL.startsWith("https://") &&
  typeof window.EDUNOVA_SUPABASE_ANON_KEY === "string" &&
  window.EDUNOVA_SUPABASE_ANON_KEY.trim().length > 0;
  const esc = v => String(v ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const dateText = d => new Date(d).toLocaleDateString("es-PE", {day:"2-digit",month:"short",year:"numeric"});
  function authMessage(text, error=false){const el=$("#auth-message");el.textContent=text;el.classList.toggle("error",error)}
  function notice(text,error=false){const el=$("#notice");el.textContent=text;el.classList.remove("hidden","error");if(error)el.classList.add("error")}
  function panel(title, subtitle, body, action=""){return `<section class="panel"><div class="panel-head"><div><h3>${title}</h3>${subtitle?`<p>${subtitle}</p>`:""}</div>${action}</div>${body}</section>`}
  function empty(text){return `<div class="empty">${esc(text)}</div>`}
  function setMode(next){mode=next;$("#tab-login").classList.toggle("active",mode==="login");$("#tab-signup").classList.toggle("active",mode==="signup");$("#auth-submit").innerHTML=mode==="login"?'Iniciar sesión <span>→</span>':'Crear cuenta <span>→</span>';$("#password").autocomplete=mode==="login"?"current-password":"new-password";authMessage("")}
  async function authSubmit(e){e.preventDefault();if(!client){authMessage("Configura primero la URL y la clave pública en supabase.js.",true);return}const btn=$("#auth-submit");btn.disabled=true;const email=$("#email").value.trim(),password=$("#password").value;try{const res=mode==="login"?await client.auth.signInWithPassword({email,password}):await client.auth.signUp({email,password});if(res.error)throw res.error;if(mode==="signup"&&!res.data.session){authMessage("Cuenta creada. Revisa tu correo si se requiere confirmación.")}else if(res.data.user){user=res.data.user;await enterApp()}}catch(err){authMessage(err.message||"No se pudo completar la operación.",true)}finally{btn.disabled=false;setMode(mode)}}
  async function enterApp() {
  if (!user) return;

  $("#auth-view").classList.add("hidden");
  $("#app-view").classList.remove("hidden");

  const logoutMobile = $("#logout-mobile");
  if (logoutMobile) {
    logoutMobile.hidden = false;
  }

  $("#user-email").textContent = user.email || "Estudiante";
  $("#user-initials").textContent = (user.email || "E")[0].toUpperCase();
  $("#today-label").textContent = dateText(new Date());
  $("#connection-label").textContent = "Sesión iniciada";

  await loadAll();
  render();
}
async function signOut() {
  if (client) {
    const { error } = await client.auth.signOut();

    if (error) {
      notice("No se pudo cerrar sesión: " + error.message, true);
      return;
    }
  }

  user = null;

  $("#app-view").classList.add("hidden");
  $("#auth-view").classList.remove("hidden");

  const logoutMobile = $("#logout-mobile");
  if (logoutMobile) {
    logoutMobile.hidden = true;
  }

  $("#auth-form").reset();
  $("#connection-label").textContent = "Sesión cerrada";
  authMessage("Has cerrado sesión.");
}
  async function fetchTable(table, order="created_at"){const {data,error}=await client.from(table).select("*").order(order,{ascending:false});if(error)throw error;return data||[]}
 
async function loadAll() {
  try {
    [
      tasks,
      notes,
      schedule,
      grades,
      studyGoals,
      timetablePeriods,
      timetableEntries
    ] = await Promise.all([
      fetchTable("tasks"),
      fetchTable("notes"),
      fetchTable("schedule_items", "starts_at"),
      fetchTable("grades"),
      fetchTable("study_goals"),
      fetchTable("timetable_periods", "period_number"),
      fetchTable("timetable_entries", "day_of_week")
    ]);

    $("#notice").classList.add("hidden");
    return true;
  } catch (err) {
    notice(
      "No se pudieron cargar los datos. Comprueba las tablas y las políticas RLS de Supabase. " +
      (err.message || ""),
      true
    );

    return false;
  }
}

  async function insert(table,values){const {error}=await client.from(table).insert({...values,user_id:user.id});if(error)throw error}
  async function update(table,id,values){const {error}=await client.from(table).update(values).eq("id",id).eq("user_id",user.id);if(error)throw error}
  async function remove(table,id){const {error}=await client.from(table).delete().eq("id",id).eq("user_id",user.id);if(error)throw error}
  function taskRows(limit=Infinity){const list=[...tasks].sort((a,b)=>Number(a.completed)-Number(b.completed)).slice(0,limit);if(!list.length)return empty("Todavía no tienes tareas. ¡Agrega la primera!");return `<div class="list">${list.map(t=>`<div class="row ${t.completed?"completed":""}"><input class="check" type="checkbox" data-complete="${esc(t.id)}" ${t.completed?"checked":""} aria-label="Completar tarea"><div class="row-main"><b>${esc(t.title)}</b><small>${esc(t.due_date?`Fecha: ${t.due_date}`:(t.subject||"Sin curso"))}</small></div><span class="pill">${t.completed?"Completada":esc(t.priority||"Normal")}</span><button class="small-button" data-delete-task="${esc(t.id)}" aria-label="Eliminar">×</button></div>`).join("")}</div>`}
function dashboardDate(value) {   if (!value) return "Sin fecha límite";    const date = new Date(value + (     /^\d{4}-\d{2}-\d{2}$/.test(value) ? "T00:00:00" : ""   ));    if (Number.isNaN(date.getTime())) return "Fecha no disponible";    return date.toLocaleDateString("es-PE", {     day: "2-digit",     month: "short"   }); }  function dashboard() {   const today = new Date();   today.setHours(0, 0, 0, 0);    const pending = tasks.filter(t => !t.completed);   const completed = tasks.filter(t => t.completed);    const overdue = pending.filter(t =>     t.due_date &&     !Number.isNaN(new Date(t.due_date + "T00:00:00").getTime()) &&     new Date(t.due_date + "T00:00:00") < today   );    const completion = tasks.length     ? Math.round(completed.length / tasks.length * 100)     : 0;    const average = grades.length     ? (grades.reduce((sum, g) => sum + Number(g.score || 0), 0)         / grades.length).toFixed(1)     : "—";    const upcomingTasks = [...pending]     .sort((a, b) => {       if (!a.due_date) return 1;       if (!b.due_date) return -1;       return a.due_date.localeCompare(b.due_date);     })     .slice(0, 4);    const upcomingSchedule = [...schedule]     .filter(s => {       if (!s.starts_at) return false;       const date = new Date(s.starts_at);       return !Number.isNaN(date.getTime()) && date >= new Date();     })     .sort((a, b) =>       new Date(a.starts_at) - new Date(b.starts_at)     )     .slice(0, 4);    const taskList = upcomingTasks.length     ? `<div class="list">${upcomingTasks.map(t => {         const isOverdue = t.due_date &&           new Date(t.due_date + "T00:00:00") < today;          return `<div class="row dashboard-row ${isOverdue ? "is-overdue" : ""}">           <div class="row-main">             <b>${esc(t.title)}</b>             <small>${esc(t.subject || "Sin curso")} · ${esc(dashboardDate(t.due_date))}</small>           </div>           <span class="pill">${isOverdue ? "Atrasada" : esc(t.priority || "Normal")}</span>           <button class="small-button" data-goto="tasks">Ver</button>         </div>`;       }).join("")}</div>`     : empty("¡Todo al día! Puedes añadir una nueva tarea.");    const scheduleList = upcomingSchedule.length     ? `<div class="list">${upcomingSchedule.map(s => `         <div class="row dashboard-row is-upcoming">           <div class="row-main">             <b>${esc(s.title)}</b>             <small>${esc(s.subject || "Actividad de estudio")} ·             ${esc(new Date(s.starts_at).toLocaleString("es-PE", {               day: "2-digit",               month: "short",               hour: "2-digit",               minute: "2-digit"             }))}</small>           </div>           <span class="pill">Próxima</span>         </div>`).join("")}</div>`     : empty("No tienes actividades futuras registradas.");    const notesList = notes.length     ? `<div class="list">${[...notes]         .sort((a, b) =>           new Date(b.created_at || 0) - new Date(a.created_at || 0)         )         .slice(0, 3).map(n => `           <div class="row dashboard-row">             <div class="row-main">               <b>${esc(n.title)}</b>               <small>${esc(n.subject || "Apunte general")}</small>             </div>             <button class="small-button" data-goto="notes">Abrir</button>           </div>`).join("")}</div>`     : empty("Tus apuntes aparecerán aquí cuando guardes uno.");    return `     <section class="dashboard-hero">       <div class="dashboard-kicker">Tu espacio de aprendizaje</div>       <h2>Un paso a la vez. Sigue avanzando.</h2>       <p>         Tienes ${pending.length} tarea(s) pendiente(s),         ${overdue.length} atrasada(s) y         ${upcomingSchedule.length} actividad(es) próximas en tu horario.         Organiza tu tiempo y avanza a tu ritmo.       </p>       <div class="dashboard-actions">         <button class="primary" data-goto="tasks">+ Nueva tarea</button>         <button class="secondary" data-goto="notes">+ Consultar apuntes</button>         <button class="secondary" data-goto="schedule">Ver horario →</button>       </div>     </section>      <div class="stats">       <div class="stat dashboard-stat">         <span class="stat-icon">◷</span>         <small>Tareas pendientes</small>         <strong>${pending.length}</strong>         <span class="stat-foot">${overdue.length} atrasada(s)</span>       </div>        <div class="stat dashboard-stat">         <span class="stat-icon">✓</span>         <small>Tareas completadas</small>         <strong>${completed.length}</strong>         <span class="stat-foot">De ${tasks.length} tarea(s) registradas</span>       </div>        <div class="stat dashboard-stat">         <span class="stat-icon">↗</span>         <small>Progreso de tareas</small>         <strong>${completion}%</strong>         <div class="progress-track" role="progressbar"           aria-label="Progreso de tareas"           aria-valuemin="0" aria-valuemax="100"           aria-valuenow="${completion}">           <div class="progress-fill" style="width:${completion}%"></div>         </div>       </div>        <div class="stat dashboard-stat">         <span class="stat-icon">★</span>         <small>Promedio registrado</small>         <strong>${average}</strong>         <span class="stat-foot">${grades.length} calificación(es)</span>       </div>     </div>      <div class="dashboard-grid">       <div>         ${panel(           "Tareas por resolver",           "Prioriza lo que tienes pendiente",           taskList,           '<button class="secondary" data-goto="tasks">Todas las tareas →</button>'         )}          ${panel(           "Próximas actividades",           "Tu agenda de estudio",           scheduleList,           '<button class="secondary" data-goto="schedule">Abrir horario →</button>'         )}       </div>        <div>         ${panel(           "Tus apuntes recientes",           "Material para repasar",           notesList,           '<button class="secondary" data-goto="notes">Todos los apuntes →</button>'         )}          <section class="panel">           <div class="panel-head">             <div>               <h3>Accesos rápidos</h3>               <p>Entra directamente a una sección.</p>             </div>           </div>            <div class="dashboard-shortcuts">             <button class="dashboard-shortcut" data-goto="tasks">               <span class="shortcut-icon">✓</span>               <span><b>Mis tareas</b><small>Organiza pendientes</small></span>             </button>              <button class="dashboard-shortcut" data-goto="notes">               <span class="shortcut-icon">▤</span>               <span><b>Mis apuntes</b><small>Repasa tus resúmenes</small></span>             </button>              <button class="dashboard-shortcut" data-goto="grades">               <span class="shortcut-icon">★</span>               <span><b>Calificaciones</b><small>Consulta tus notas</small></span>             </button>              <button class="dashboard-shortcut" data-goto="schedule">               <span class="shortcut-icon">◷</span>               <span><b>Mi horario</b><small>Organiza tu tiempo</small></span>             </button>           </div>            <p class="dashboard-welcome-note">             Tus estadísticas se calculan a partir de los registros             disponibles en tu cuenta.           </p>         </section>       </div>     </div>   `; }
  
function studyGoalsPanel() {
  const goals = studyGoals.filter(g => {
    const start = new Date(g.week_start + "T00:00:00");
    const now = new Date();
    const monday = new Date(now);
    monday.setHours(0, 0, 0, 0);
    monday.setDate(monday.getDate() - (monday.getDay() + 6) % 7);
    return !g.week_start || start >= monday;
  });

  const rows = goals.length
    ? `<div class="list">${goals.map(g => {
        const target = Number(g.target) || 1;
        const completed = Number(g.completed) || 0;
        const progress = Math.min(100, Math.round(completed / target * 100));

        return `<div class="row">
          <div class="row-main">
            <b>${esc(g.title)}</b>
            <small>${completed} de ${target} tareas · ${progress}%</small>
            <div class="progress-track">
              <div class="progress-fill" style="width:${progress}%"></div>
            </div>
          </div>
          <button class="small-button" data-goal-add="${esc(g.id)}">+1</button>
          <button class="small-button" data-goal-delete="${esc(g.id)}">×</button>
        </div>`;
      }).join("")}</div>`
    : empty("Todavía no tienes objetivos de estudio.");

  return `${panel(
    "Mis objetivos",
    "Define tus metas y sigue tu progreso semanal",
    `<form id="goal-form">
      <div class="form-grid">
        <div class="full">
          <label for="goal-title">Objetivo</label>
          <input id="goal-title" name="title" maxlength="150"
            required placeholder="Ej. Completar mis tareas">
        </div>
        <div class="full">
          <label for="goal-target">Meta semanal</label>
          <input id="goal-target" name="target" type="number"
            min="1" max="100" value="5" required>
        </div>
      </div>
      <div class="form-actions">
        <button class="primary" type="submit">Crear objetivo +</button>
      </div>
    </form>`
  )}${panel("Objetivos de esta semana", "", rows)}`;
}

  function tasksPage(){return `${panel("Agregar tarea","Registra el trabajo que necesitas hacer",`<form id="task-form"><div class="form-grid"><div class="full"><label for="task-title">Nombre de la tarea</label><input id="task-title" name="title" placeholder="Ej. Terminar el informe" maxlength="150" required></div><div><label for="task-subject">Curso</label><input id="task-subject" name="subject" placeholder="Ej. Ciencia y Tecnología" maxlength="100"></div><div><label for="task-due">Fecha límite</label><input id="task-due" name="due_date" type="date"></div><div class="full"><label for="task-priority">Prioridad</label><select id="task-priority" name="priority"><option>Normal</option><option>Alta</option><option>Baja</option></select></div></div><div class="form-actions"><button class="primary" type="submit">Guardar tarea +</button></div></form>`)}${panel("Lista de tareas",`${tasks.length} tarea(s) registrada(s)`,taskRows())}`}
  function notesPage(){const rows=notes.length?`<div class="list">${notes.map(n=>`<article class="row" style="align-items:flex-start"><div class="row-main"><b>${esc(n.title)}</b><small>${esc(n.subject||"Apunte general")} · ${dateText(n.created_at||new Date())}</small><p class="note-content">${esc(n.content||"")}</p></div><button class="small-button" data-delete-note="${esc(n.id)}">×</button></article>`).join("")}</div>`:empty("Todavía no has guardado apuntes.");return `${panel("Guardar apunte","Guarda ideas importantes para repasar",`<form id="note-form"><div class="form-grid"><div class="full"><label for="note-title">Título</label><input id="note-title" name="title" required maxlength="150" placeholder="Tema de clase"></div><div class="full"><label for="note-subject">Curso</label><input id="note-subject" name="subject" maxlength="100" placeholder="Curso o materia"></div><div class="full"><label for="note-content">Contenido</label><textarea id="note-content" name="content" rows="4" maxlength="12000" required placeholder="Escribe tu resumen…"></textarea></div></div><div class="form-actions"><button class="primary" type="submit">Guardar apunte +</button></div></form>`)}${panel("Mis apuntes",`${notes.length} apunte(s)`,rows)}`}
  function schedulePage(){const rows=[...schedule].sort((a,b)=>String(a.starts_at||"").localeCompare(String(b.starts_at||"")));const body=rows.length?`<div class="list">${rows.map(s=>`<div class="row"><div class="row-main"><b>${esc(s.title)}</b><small>${esc(s.starts_at?new Date(s.starts_at).toLocaleString("es-PE",{dateStyle:"medium",timeStyle:"short"}):"Sin fecha")} ${s.subject?"· "+esc(s.subject):""}</small></div><button class="small-button" data-delete-schedule="${esc(s.id)}">×</button></div>`).join("")}</div>`:empty("Agrega tus clases, exámenes o sesiones de estudio.");return `${panel("Añadir al horario","Organiza tus próximas actividades",`<form id="schedule-form"><div class="form-grid"><div class="full"><label for="schedule-title">Actividad</label><input id="schedule-title" name="title" required maxlength="150" placeholder="Ej. Repasar inglés"></div><div><label for="schedule-subject">Curso</label><input id="schedule-subject" name="subject" maxlength="100" placeholder="Curso"></div><div><label for="schedule-start">Fecha y hora</label><input id="schedule-start" name="starts_at" type="datetime-local" required></div></div><div class="form-actions"><button class="primary" type="submit">Guardar actividad +</button></div></form>`)}${panel("Próximas actividades",`${rows.length} actividad(es)`,body)}`}
  
async function addTimetablePeriod() {
 
const usedNumbers = timetablePeriods.map(
  p => Number(p.period_number)
);
const number = Array.from(
  { length: 20 },
  (_, i) => i + 1
).find(n => !usedNumbers.includes(n));


  const start = prompt("Hora de inicio (HH:MM):", "08:00");
  if (start === null) return;

  const end = prompt("Hora de fin (HH:MM):", "08:45");
  if (end === null) return;

  const validTime = value =>
    /^([01]\d|2[0-3]):[0-5]\d$/.test(value);

  if (!validTime(start) || !validTime(end) || start >= end) {
    notice("Introduce horas válidas. La hora final debe ser posterior.", true);
    return;
  }

  try {
    await insert("timetable_periods", {
      period_number: number,
      start_time: start,
      end_time: end
    });
    await reload("Período añadido correctamente.");
  } catch (err) {
    notice(err.message || "No se pudo añadir el período.", true);
  }
}

async function configureTimetablePeriod() {
  if (!timetablePeriods.length) {
    notice("Primero añade un período.", true);
    return;
  }

  const number = prompt(
    "¿Qué número de período deseas editar?",
    String(timetablePeriods[0].period_number)
  );
  if (number === undefined) {

  const period = timetablePeriods.find(
    p => Number(p.period_number) === Number(number)
  );

  if (!period) {
    notice("No se encontró ese período.", true);
    return;
  }

  const start = prompt("Nueva hora de inicio (HH:MM):", String(period.start_time).slice(0, 5));
  if (start === null) return;

  const end = prompt("Nueva hora de fin (HH:MM):", String(period.end_time).slice(0, 5));
  if (end === null) return;

  const validTime = value =>
    /^([01]\d|2[0-3]):[0-5]\d$/.test(value);

  if (!validTime(start) || !validTime(end) || start >= end) {
    notice("Introduce horas válidas. La hora final debe ser posterior.", true);
    return;
  }

  try {
    await update("timetable_periods", period.id, {
      start_time: start,
      end_time: end
    });
    await reload("Horario actualizado.");
  } catch (err) {
    notice(err.message || "No se pudo actualizar el período.", true);
  }
}

async function editTimetableEntry(day, periodNumber) {
  const period = timetablePeriods.find(
    p => Number(p.period_number) === Number(periodNumber)
  );

  if (!period) {
    notice("Primero configura ese período.", true);
    return;
  }

  const existing = timetableEntries.find(
    e =>
      Number(e.day_of_week) === Number(day) &&
      Number(e.period_number) === Number(periodNumber)
  );

  const subject = prompt(
    "Nombre de la asignatura (vacío para borrar):",
    existing?.subject || ""
  );

  if (subject === null) return;

  const days = {
    1: "Lunes",
    2: "Martes",
    3: "Miércoles",
    4: "Jueves",
    5: "Viernes"
  };

  if (!subject.trim()) {
    if (existing) {
      try {
        await remove("timetable_entries", existing.id);
        await reload("Casilla vaciada.");
      } catch (err) {
        notice(err.message || "No se pudo borrar la casilla.", true);
      }
    }
    return;
  }

  const teacher = prompt(
    "Nombre del profesor:",
    existing?.teacher || ""
  );
  if (teacher === null) return;

  const room = prompt(
    "Aula (opcional):",
    existing?.room || ""
  );
  if (room === null) return;

  const color = prompt(
    "Color hexadecimal (ej. #DCEBFF):",
    existing?.color || "#DCEBFF"
  );
  if (color === null) return;

  if (!/^#[0-9A-Fa-f]{6}$/.test(color)) {
    notice("El color debe tener formato hexadecimal, como #DCEBFF.", true);
    return;
  }

  const values = {
    day_of_week: Number(day),
    period_number: Number(periodNumber),
    subject: subject.trim(),
    teacher: teacher.trim(),
    room: room.trim(),
    color
  };

  try {
    if (existing) {
      await update("timetable_entries", existing.id, values);
    } else {
      await insert("timetable_entries", values);
    }

    await reload(
      `${days[day]}: ${subject.trim()} guardado correctamente.`
    );
  } catch (err) {
    notice(err.message || "No se pudo guardar la clase.", true);
  }
}

function timetablePage() {
  const days = [
    { id: 1, name: "Lunes" },
    { id: 2, name: "Martes" },
    { id: 3, name: "Miércoles" },
    { id: 4, name: "Jueves" },
    { id: 5, name: "Viernes" }
  ];

  const periods = [...timetablePeriods].sort(
    (a, b) => a.period_number - b.period_number
  );

  const entries = timetableEntries;

  const cells = days.map(day => `
    <section class="panel">
      <h3>${day.name}</h3>
      <div class="list">
        ${periods.map(period => {
          const entry = entries.find(e =>
            Number(e.day_of_week) === day.id &&
            Number(e.period_number) === Number(period.period_number)
          );

          return `
            <div class="row" style="border-left:5px solid ${esc(entry?.color || "#DCEBFF")}">
              <div class="row-main">
                <b>${esc(entry?.subject || (period.is_break ? "RECREO" : "Sin asignar"))}</b>
                <small>
                  ${esc(String(period.start_time).slice(0, 5))}
                  – ${esc(String(period.end_time).slice(0, 5))}
                </small>
                ${entry?.teacher
                  ? `<small>${esc(entry.teacher)}</small>`
                  : ""}
              </div>
              <button class="small-button"
                data-timetable-edit="${day.id}:${period.period_number}">
                Editar
              </button>
            </div>
          `;
        }).join("")}
      </div>
    </section>
  `).join("");

  return `
    ${panel(
      "Mi horario escolar",
      "Organiza tus clases de lunes a viernes",
      `
        <p>Períodos configurados: ${periods.length}</p>
        <button class="primary" data-period-add>
          + Añadir período
        </button>
        <button class="secondary" data-period-config>
          Configurar horas
        </button>
      `
    )}
    ${cells}
  `;
}

  function gradesPage(){const rows=grades.length?`<div class="list">${grades.map(g=>`<div class="row"><div class="row-main"><b>${esc(g.title)}</b><small>${esc(g.subject||"Curso sin especificar")}</small></div><span class="grade-value">${esc(g.score)} / ${esc(g.max_score||20)}</span><button class="small-button" data-delete-grade="${esc(g.id)}">×</button></div>`).join("")}</div>`:empty("Registra tus notas para llevar un seguimiento.");return `${panel("Registrar calificación","Usa la escala que corresponda a tu colegio",`<form id="grade-form"><div class="form-grid"><div class="full"><label for="grade-title">Evaluación</label><input id="grade-title" name="title" required maxlength="150" placeholder="Ej. Práctica de unidad 1"></div><div><label for="grade-subject">Curso</label><input id="grade-subject" name="subject" maxlength="100" placeholder="Curso"></div><div><label for="grade-score">Nota obtenida</label><input id="grade-score" name="score" type="number" min="0" step="0.1" required placeholder="Ej. 17"></div><div class="full"><label for="grade-max">Nota máxima</label><input id="grade-max" name="max_score" type="number" min="0.1" step="0.1" value="20" required></div></div><div class="form-actions"><button class="primary" type="submit">Guardar nota +</button></div></form>`)}${panel("Mis calificaciones",`${grades.length} calificación(es)`,rows)}`}
  const info={dashboard:["¡Ohayoo :)!","Vamos a avanzar." ,"Este es tu resumen de aprendizaje."],tasks:["Mis","tareas","Organiza tus pendientes y marca lo que termines."],notes:["Mis","apuntes","Guarda tus resúmenes y consulta tus notas."],schedule:["Mi","horario","Planifica clases y sesiones de estudio."],timetable:["Personalizar","mi horario","Configura tus períodos, horas y clases de lunes a viernes."],grades:["Mis","calificaciones","Registra tus resultados y observa tu avance."],goals: ["Mis", "objetivos", "Define tus metas semanales y sigue tu progreso."]};
  function render(){const p=info[activePage]||info.dashboard;$("#page-title").innerHTML=`${esc(p[0])} <span>${esc(p[1])}</span>`;$("#page-subtitle").textContent=p[2];$("#page-content").innerHTML=(   activePage === "goals"     ? studyGoalsPanel()     : ({   dashboard,   tasks: tasksPage,   notes: notesPage,   schedule: schedulePage,   timetable: timetablePage,   grades: gradesPage,   goals: studyGoalsPanel }[activePage] || dashboard)() );document.querySelectorAll(".nav-item").forEach(b=>b.classList.toggle("active",b.dataset.page===activePage))}
   async function reload(msg) {   const loaded = await loadAll();    render();    if (msg && loaded) {     notice(msg);   } }
  async function submitForm(e){const f=e.target;if(!(f instanceof HTMLFormElement))return; const tables = {   "task-form": "tasks",   "note-form": "notes",   "schedule-form": "schedule_items",   "grade-form": "grades",   "goal-form": "study_goals" }; const table = tables[f.id]; if (!table) return; e.preventDefault(); const values = Object.fromEntries(new FormData(f).entries()); try {   if (table === "study_goals") {     values.target = Number(values.target);     values.completed = 0;     const now = new Date();     const monday = new Date(now);     monday.setHours(0, 0, 0, 0);     monday.setDate(monday.getDate() - (monday.getDay() + 6) % 7);     values.week_start = monday.toISOString().slice(0, 10);   }
if (table === "grades") {
  values.score = Number(values.score);
  values.max_score = Number(values.max_score);

  if (
    !Number.isFinite(values.score) ||
    !Number.isFinite(values.max_score) ||
    values.score < 0 ||
    values.max_score <= 0
  ) {
    throw Error("Introduce una nota válida y una nota máxima mayor que cero.");
  }

  if (values.score > values.max_score) {
    throw Error("La nota obtenida no puede superar la nota máxima.");
  }
}
if(table==="schedule_items")values.starts_at=new Date(values.starts_at).toISOString();await insert(table,values);await reload("Guardado correctamente.")}catch(err){notice(err.message||"No se pudo guardar.",true)}}

async function clickHandler(e) {
  const b = e.target.closest("button");
  if (!b) return;

  if (b.dataset.timetableEdit) {
    const [day, period] = b.dataset.timetableEdit.split(":");
    await editTimetableEntry(Number(day), Number(period));
    return;
  }



if (b.dataset.periodAdd !== undefined) {
  await addTimetablePeriod();
  return;
}

if (b.dataset.periodConfig !== undefined) {
  await configureTimetablePeriod();
  return;
}

  if (b.dataset.page || b.dataset.goto) {
    activePage = b.dataset.page || b.dataset.goto;
    $("#notice").classList.add("hidden");
    render();
    return;
  }

  if (b.dataset.goalAdd) {
    const goal = studyGoals.find(
      g => String(g.id) === b.dataset.goalAdd
    );
    if (!goal) return;

    const completed = Number(goal.completed) || 0;
    const target = Number(goal.target) || 1;

    if (completed >= target) {
      notice("¡Ya alcanzaste esta meta!");
      return;
    }

    try {
      await update("study_goals", goal.id, {
        completed: completed + 1
      });
      await reload("¡Progreso actualizado!");
    } catch (err) {
      notice(err.message || "No se pudo actualizar la meta.", true);
    }
    return;
  }

  if (b.dataset.goalDelete) {
    try {
      await remove("study_goals", b.dataset.goalDelete);
      await reload("Objetivo eliminado.");
    } catch (err) {
      notice(err.message || "No se pudo eliminar el objetivo.", true);
    }
    return;
  }

  const mappings = [
    ["deleteTask", "tasks"],
    ["deleteNote", "notes"],
    ["deleteSchedule", "schedule_items"],
    ["deleteGrade", "grades"]
  ];

  for (const [key, table] of mappings) {
    if (b.dataset[key]) {
      try {
        await remove(table, b.dataset[key]);
        await reload("Elemento eliminado.");
      } catch (err) {
        notice(err.message || "No se pudo eliminar.", true);
      }
      return;
    }
  }
}

  async function changeHandler(e){const el=e.target;if(!el.matches("[data-complete]"))return;try{await update("tasks",el.dataset.complete,{completed:el.checked});await reload(el.checked?"Tarea completada.":"Tarea marcada como pendiente.")}catch(err){notice(err.message||"No se pudo actualizar.",true)}}
 async function init() {
  $("#tab-login").addEventListener("click", () => setMode("login"));
  $("#tab-signup").addEventListener("click", () => setMode("signup"));
  $("#auth-form").addEventListener("submit", authSubmit);
  $("#logout-button").addEventListener("click", signOut);

  const logoutMobile = $("#logout-mobile");
  if (logoutMobile) {
    logoutMobile.addEventListener("click", signOut);
  }

  $("#page-content").addEventListener("submit", submitForm);
  document.addEventListener("click", clickHandler);
  $("#page-content").addEventListener("change", changeHandler);

  if (!configured()) {
    $("#connection-label").textContent = "Falta configurar Supabase";
    $("#auth-submit").disabled = true;
    authMessage(
      "Primero configura la URL y la clave pública en supabase.js.",
      true
    );
    return;
  }

  if (!window.supabase?.createClient) {
    authMessage(
      "No se pudo cargar Supabase. Revisa tu conexión a internet.",
      true
    );
    return;
  }

  client = window.supabase.createClient(
    window.EDUNOVA_SUPABASE_URL,
    window.EDUNOVA_SUPABASE_ANON_KEY
  );

  $("#connection-label").textContent = "Conexión preparada";

 
try {
  const { data, error } = await client.auth.getSession();

  if (error) throw error;

  if (data.session?.user) {
    user = data.session.user;
    await enterApp();
  }
} catch (err) {
  authMessage(
    err.message || "No se pudo comprobar la sesión. Inténtalo nuevamente.",
    true
  );
}

 document.addEventListener("DOMContentLoaded", init);
})();
