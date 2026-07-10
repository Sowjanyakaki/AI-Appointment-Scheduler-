import { createSession, getSession } from "@/lib/conversation/session-store";
import { advance } from "@/lib/conversation/state-machine";

export async function POST(request: Request) {
  const body = (await request.json()) as { sessionId?: string; message: string };

  const session = body.sessionId ? getSession(body.sessionId) : null;
  const activeSession = session ?? createSession();

  const { session: nextSession, reply } = await advance(activeSession, body.message);

  return Response.json({
    sessionId: nextSession.id,
    reply,
    state: nextSession.state,
  });
}
