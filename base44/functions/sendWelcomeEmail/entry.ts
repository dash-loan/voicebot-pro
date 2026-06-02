import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { email, password, appUrl } = await req.json();

    const html = `
<!DOCTYPE html>
<html dir="rtl" lang="he">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>ברוכים הבאים ל-VoiceBot Pro</title>
</head>
<body style="margin:0;padding:0;background:#0f1629;font-family:'Segoe UI',Arial,sans-serif;direction:rtl;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0f1629;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

          <!-- Header -->
          <tr>
            <td align="center" style="padding-bottom:32px;">
              <div style="display:inline-block;background:linear-gradient(135deg,#1e2d5a,#2a3f7e);border-radius:16px;padding:20px 36px;">
                <span style="color:#f5c518;font-size:28px;font-weight:800;letter-spacing:1px;">🤖 VoiceBot Pro</span>
              </div>
            </td>
          </tr>

          <!-- Main Card -->
          <tr>
            <td style="background:#1a2340;border-radius:20px;padding:48px 40px;box-shadow:0 8px 40px rgba(0,0,0,0.4);">

              <!-- Icon -->
              <div style="text-align:center;margin-bottom:24px;">
                <div style="display:inline-block;background:linear-gradient(135deg,#f5c518,#e6a800);border-radius:50%;width:72px;height:72px;line-height:72px;font-size:36px;">🎉</div>
              </div>

              <!-- Title -->
              <h1 style="color:#ffffff;font-size:28px;font-weight:700;text-align:center;margin:0 0 8px 0;">ברוכים הבאים!</h1>
              <p style="color:#f5c518;font-size:16px;text-align:center;margin:0 0 32px 0;font-weight:500;">ההזמנה שלך ל-VoiceBot Pro מוכנה</p>

              <!-- Body -->
              <p style="color:#cbd5e1;font-size:16px;line-height:1.7;margin:0 0 16px 0;">
                שלום,
              </p>
              <p style="color:#cbd5e1;font-size:16px;line-height:1.7;margin:0 0 32px 0;">
                אנחנו שמחים לבשר שהוזמנת להצטרף למערכת <strong style="color:#ffffff;">VoiceBot Pro</strong> — הפלטפורמה המתקדמת לניהול קמפיינים קוליים חכמים מבוססי בינה מלאכותית.
              </p>

              <!-- Features -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:36px;">
                <tr>
                  <td style="padding:10px 0;border-bottom:1px solid #2d3a5a;">
                    <span style="color:#f5c518;font-size:18px;margin-left:10px;">📞</span>
                    <span style="color:#e2e8f0;font-size:15px;">קמפיינים קוליים אוטומטיים</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding:10px 0;border-bottom:1px solid #2d3a5a;">
                    <span style="color:#f5c518;font-size:18px;margin-left:10px;">🤖</span>
                    <span style="color:#e2e8f0;font-size:15px;">סוכן AI מדבר בעברית ובערבית</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding:10px 0;border-bottom:1px solid #2d3a5a;">
                    <span style="color:#f5c518;font-size:18px;margin-left:10px;">📊</span>
                    <span style="color:#e2e8f0;font-size:15px;">דשבורד ניתוח תוצאות בזמן אמת</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding:10px 0;">
                    <span style="color:#f5c518;font-size:18px;margin-left:10px;">✅</span>
                    <span style="color:#e2e8f0;font-size:15px;">מיון לידים חמים באופן אוטומטי</span>
                  </td>
                </tr>
              </table>

              <!-- CTA Button -->
              <div style="text-align:center;margin-bottom:32px;">
                <a href="${appUrl || 'https://vagabond-voice-flow-pro.base44.app'}" 
                   style="display:inline-block;background:linear-gradient(135deg,#f5c518,#e6a800);color:#1a1a2e;font-size:18px;font-weight:700;text-decoration:none;padding:16px 48px;border-radius:50px;box-shadow:0 4px 20px rgba(245,197,24,0.4);">
                  כניסה למערכת ←
                </a>
              </div>

              <!-- Credentials Box -->
              ${password ? `
              <div style="background:#0d1f3c;border-radius:12px;padding:20px 24px;border:1px solid #f5c518;margin-bottom:24px;">
                <p style="color:#f5c518;font-size:14px;font-weight:700;margin:0 0 12px 0;text-align:center;">פרטי כניסה למערכת</p>
                <table width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="padding:6px 0;">
                      <span style="color:#94a3b8;font-size:14px;">אימייל: </span>
                      <span style="color:#ffffff;font-size:14px;font-weight:600;">${email}</span>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:6px 0;">
                      <span style="color:#94a3b8;font-size:14px;">סיסמה: </span>
                      <span style="color:#f5c518;font-size:14px;font-weight:700;letter-spacing:2px;">${password}</span>
                    </td>
                  </tr>
                </table>
                <p style="color:#64748b;font-size:12px;margin:12px 0 0 0;text-align:center;">מומלץ לשנות את הסיסמה לאחר הכניסה הראשונה</p>
              </div>
              ` : ''}

              <!-- Note -->
              <div style="background:#0f1629;border-radius:12px;padding:16px 20px;border:1px solid #2d3a5a;">
                <p style="color:#94a3b8;font-size:13px;margin:0;text-align:center;">
                  אם לא ביקשת הזמנה זו, ניתן להתעלם ממייל זה בבטחה.
                </p>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td align="center" style="padding-top:24px;">
              <p style="color:#4a5568;font-size:13px;margin:0;">
                © 2025 VoiceBot Pro · כל הזכויות שמורות
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `;

    await base44.asServiceRole.integrations.Core.SendEmail({
      to: email,
      subject: '🎉 הוזמנת ל-VoiceBot Pro — כניסה למערכת',
      body: html,
      content_type: 'text/html'
    });

    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});