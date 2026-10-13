import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { ...corsHeaders, "Content-Type": "application/json" },
});

const tools = [
  { type: "function", name: "list_records", description: "Consulta los registros propios del usuario en un módulo de EduNova. Usa esto antes de responder preguntas sobre sus datos.", parameters: { type: "object", properties: { module: { type: "string", enum: ["tasks", "notes", "schedule_items", "grades", "study_goals", "timetable_periods", "timetable_entries"] } }, required: ["module"], additionalProperties: false } },
  { type: "function", name: "get_profile", description: "Consulta los datos básicos de perfil de la sesión actual. No revela credenciales ni información privada adicional.", parameters: { type: "object", properties: {}, required: [], additionalProperties: false } },
  { type: "function", name: "create_record", description: "Crea un registro nuevo en el módulo indicado. Utilízalo solo cuando el usuario haya pedido crear o guardar algo claramente.", parameters: { type: "object", properties: { module: { type: "string", enum: ["tasks", "notes", "schedule_items", "grades", "study_goals"] }, data: { type: "object", properties: { title: { type: "string" }, subject: { type: "string" }, due_date: { type: "string" }, priority: { type: "string", enum: ["Normal", "Alta", "Baja"] }, content: { type: "string" }, starts_at: { type: "string" }, score: { type: "number" }, max_score: { type: "number" }, target: { type: "integer" }, week_start: { type: "string" } }, required: ["title"], additionalProperties: false } }, required: ["module", "data"], additionalProperties: false } },
  { type: "function", name: "complete_task", description: "Marca como completada una tarea del usuario. Primero consulta tasks para obtener el id correcto.", parameters: { type: "object", properties: { task_id: { type: "string" } }, required: ["task_id"], additionalProperties: false } },
  { type: "function", name: "increment_goal", description: "Incrementa en uno el progreso de un objetivo de estudio. Primero consulta study_goals para identificar el objetivo correcto.", parameters: { type: "object", properties: { goal_id: { type: "string" } }, required: ["goal_id"], additionalProperties: false } },
] as const;

const readableModules = ["tasks", "notes", "schedule_items", "grades", "study_goals", "timetable_periods", "timetable_entries"];
const allowedFields: Record<string, string[]> = {
  tasks: ["title", "subject", "due_date", "priority", "completed"],
  notes: ["title", "subject", "content"],
  schedule_items: ["title", "subject", "starts_at"],
  grades: ["title", "subject", "score", "max_score"],
  study_goals: ["title", "target", "completed", "week_start"],
};

function validateCreate(module: string, raw: Record<string, unknown>) {
  if (!allowedFields[module]) throw new Error("Módulo no permitido.");
  const data: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (!allowedFields[module].includes(key)) throw new Error(`Campo no permitido: ${key}`);
    if (typeof value === "string" && value.length > (key === "content" ? 12000 : 500)) throw new Error("El contenido es demasiado largo.");
    data[key] = value;
  }
  if (typeof data.title !== "string" || !data.title.trim()) throw new Error("Falta el título.");
  data.title = data.title.trim();
  if (module === "tasks") {
    data.completed = false;
    if (data.due_date && !/^\d{4}-\d{2}-\d{2}$/.test(String(data.due_date))) throw new Error("La fecha límite debe usar formato AAAA-MM-DD.");
    if (data.priority && !["Normal", "Alta", "Baja"].includes(String(data.priority))) data.priority = "Normal";
  }
  if (module === "notes" && (typeof data.content !== "string" || !data.content.trim())) throw new Error("El apunte necesita contenido.");
  if (module === "schedule_items") {
    const date = new Date(String(data.starts_at || ""));
    if (!data.starts_at || Number.isNaN(date.getTime())) throw new Error("Falta una fecha y hora válida para el horario.");
    data.starts_at = date.toISOString();
  }
  if (module === "grades") {
    if (typeof data.score !== "number" || typeof data.max_score !== "number" || data.score < 0 || data.max_score <= 0 || data.score > data.max_score) throw new Error("Revisa la nota y la nota máxima.");
  }
  if (module === "study_goals") {
    if (!Number.isInteger(data.target) || Number(data.target) < 1) throw new Error("La meta necesita un objetivo numérico mayor que cero.");
    data.completed = 0;
    if (!data.week_start) {
      const now = new Date();
      now.setUTCHours(0, 0, 0, 0);
      now.setUTCDate(now.getUTCDate() - (now.getUTCDay() + 6) % 7);
      data.week_start = now.toISOString().slice(0, 10);
    }
  }
  if (data.subject === "") delete data.subject;
  return data;
}

async function executeTool(name: string, args: Record<string, unknown>, db: any, userId: string) {
  if (name === "get_profile") {
    return { email: user.email || null, display_name: user.user_metadata?.display_name || user.user_metadata?.full_name || null, created_at: user.created_at || null };
  }
  if (name === "list_records") {
    const module = String(args.module || "");
    if (!readableModules.includes(module)) throw new Error("Módulo no permitido.");
    const { data, error } = await db.from(module).select("*").eq("user_id", userId).limit(40);
    if (error) throw error;
    return { module, records: data || [] };
  }
  if (name === "create_record") {
    const module = String(args.module || "");
    const data = validateCreate(module, (args.data || {}) as Record<string, unknown>);
    const { data: created, error } = await db.from(module).insert({ ...data, user_id: userId }).select().single();
    if (error) throw error;
    return { success: true, module, record: created, message: "Registro creado correctamente." };
  }
  if (name === "complete_task") {
    const id = String(args.task_id || "");
    const { data, error } = await db.from("tasks").update({ completed: true }).eq("id", id).eq("user_id", userId).select("id,title,completed").maybeSingle();
    if (error) throw error;
    if (!data) throw new Error("No se encontró esa tarea en tu cuenta.");
    return { success: true, record: data, message: "Tarea marcada como completada." };
  }
  if (name === "increment_goal") {
    const id = String(args.goal_id || "");
    const { data: goal, error: readError } = await db.from("study_goals").select("id,title,target,completed").eq("id", id).eq("user_id", userId).maybeSingle();
    if (readError) throw readError;
    if (!goal) throw new Error("No se encontró ese objetivo en tu cuenta.");
    const completed = Number(goal.completed || 0), target = Number(goal.target || 1);
    if (completed >= target) return { success: true, record: goal, message: "Ese objetivo ya alcanzó su meta." };
    const { data, error } = await db.from("study_goals").update({ completed: completed + 1 }).eq("id", id).eq("user_id", userId).select("id,title,target,completed").single();
    if (error) throw error;
    return { success: true, record: data, message: "Progreso del objetivo actualizado." };
  }
  throw new Error("Herramienta no reconocida.");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Método no permitido." }, 405);

  const authorization = req.headers.get("Authorization") || "";
  const token = authorization.replace(/^Bearer\s+/i, "");
  if (!token) return json({ error: "Debes iniciar sesión para usar EduNova AI." }, 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const publishableMap = (() => {
    try { return JSON.parse(Deno.env.get("SUPABASE_PUBLISHABLE_KEYS") || "{}"); } catch { return {}; }
  })();
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || publishableMap.default || "";
  const openaiKey = Deno.env.get("OPENAI_API_KEY") || "";
  if (!supabaseUrl || !anonKey) return json({ error: "Falta la configuración del backend de Supabase." }, 500);
  if (!openaiKey) return json({ error: "Falta configurar OPENAI_API_KEY como secreto de esta función." }, 503);

  const db = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false, autoRefreshToken: false } });
  const { data: authData, error: authError } = await db.auth.getUser(token);
  if (authError || !authData.user) return json({ error: "La sesión no es válida. Vuelve a iniciar sesión." }, 401);
  const user = authData.user;

  let body: { message?: string; history?: { role: string; content: string }[] };
  try { body = await req.json(); } catch { return json({ error: "Solicitud JSON no válida." }, 400); }
  const message = String(body.message || "").trim();
  if (!message || message.length > 2000) return json({ error: "Escribe un mensaje de hasta 2000 caracteres." }, 400);
  const history = Array.isArray(body.history) ? body.history.slice(-8).filter((m) => ["user", "assistant"].includes(m.role) && typeof m.content === "string").map((m) => ({ role: m.role, content: m.content.slice(0, 2000) })) : [];

  const input: any[] = [
    { role: "system", content: `Eres EduNova AI, asistente académico en español. Fecha actual: ${new Date().toISOString().slice(0,10)}. Usuario autenticado: ${user.email || "estudiante"}. Ayudas con el uso de EduNova y el estudio. Para preguntas sobre datos personales consulta las herramientas; no inventes registros. Ejecuta acciones solo cuando el usuario las pida claramente. Para completar una tarea o avanzar un objetivo, primero lista el módulo y usa el ID exacto. Nunca borres datos ni reveles datos de otros usuarios. Si faltan datos imprescindibles (como fecha/hora de una actividad), pregunta antes de ejecutar. Después de cada acción, informa claramente qué se guardó. No afirmes que una acción se completó si la herramienta falló.` },
    ...history,
    { role: "user", content: message },
  ];

  let actionsPerformed = false;
  let totalToolCalls = 0;
  try {
    for (let round = 0; round < 4; round++) {
      const aiResponse = await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: { "Authorization": `Bearer ${openaiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model: "gpt-4.1-mini", input, tools, tool_choice: "auto", max_output_tokens: 900 }),
      });
      const responseBody = await aiResponse.json();
      if (!aiResponse.ok) {
        const messageText = responseBody?.error?.message || "El proveedor de IA rechazó la solicitud.";
        return json({ error: `Error del servicio de IA: ${messageText}` }, aiResponse.status === 429 ? 429 : 502);
      }
      const output = Array.isArray(responseBody.output) ? responseBody.output : [];
      const calls = output.filter((item: any) => item.type === "function_call");
      if (!calls.length) {
        const reply = String(responseBody.output_text || output.flatMap((item: any) => item.content || []).filter((part: any) => part.type === "output_text").map((part: any) => part.text).join("\n") || "No pude preparar una respuesta. Inténtalo de nuevo.");
        return json({ reply, actionsPerformed });
      }
      totalToolCalls += calls.length;
      if (totalToolCalls > 6) return json({ reply: "La solicitud requiere demasiadas operaciones. Divídela en pasos más pequeños.", actionsPerformed });
      input.push(...output);
      for (const call of calls) {
        let result: unknown;
        try {
          const args = JSON.parse(call.arguments || "{}");
          result = await executeTool(call.name, args, db, user.id);
          if ((result as any)?.success) actionsPerformed = true;
        } catch (toolError) {
          result = { success: false, error: toolError instanceof Error ? toolError.message : "No se pudo ejecutar la acción." };
        }
        input.push({ type: "function_call_output", call_id: call.call_id, output: JSON.stringify(result) });
      }
    }
    return json({ reply: "He alcanzado el límite de pasos para esta solicitud. Revisa tus módulos antes de volver a intentarlo.", actionsPerformed });
  } catch (error) {
    console.error("EduNova AI error:", error instanceof Error ? error.message : "unknown");
    return json({ error: "No se pudo contactar con el servicio de IA. Revisa la configuración e inténtalo otra vez." }, 502);
  }
});
