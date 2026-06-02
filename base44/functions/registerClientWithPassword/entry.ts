import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// פונקציה זו נקראת על ידי אדמין כדי ליצור לקוח חדש עם סיסמה מוגדרת מראש.
// Base44 SDK תומך ב-register ללא OTP כאשר קוראים לו מ-service role.
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (user?.role !== 'admin') {
      return Response.json({ error: 'אין הרשאה' }, { status: 403 });
    }

    const { email, password } = await req.json();

    if (!email || !password || password.length < 6) {
      return Response.json({ error: 'חסר אימייל או סיסמה (מינימום 6 תווים)' }, { status: 400 });
    }

    // רישום ישיר עם סיסמה - ללא צורך באימות OTP
    const result = await base44.asServiceRole.auth.register({ email, password, skipVerification: true });

    return Response.json({ success: true, data: result });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});