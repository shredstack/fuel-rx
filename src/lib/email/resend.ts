import { Resend } from 'resend';

// Lazy initialization to avoid build-time errors when RESEND_API_KEY is not set
let resend: Resend | null = null;

function getResendClient(): Resend | null {
  if (!process.env.RESEND_API_KEY) {
    return null;
  }
  if (!resend) {
    resend = new Resend(process.env.RESEND_API_KEY);
  }
  return resend;
}

const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'notifications@fuelrx.app';
const REPLY_TO_EMAIL = process.env.RESEND_REPLY_TO_EMAIL || 'shredstacksarah@gmail.com';

interface SendMealPlanReadyEmailParams {
  to: string;
  userName: string;
  mealPlanId: string;
  themeName?: string;
}

export async function sendMealPlanReadyEmail({
  to,
  userName,
  mealPlanId,
  themeName,
}: SendMealPlanReadyEmailParams): Promise<{ success: boolean; error?: string }> {
  const client = getResendClient();

  // Skip if Resend is not configured
  if (!client) {
    console.log('[Email] Skipping email - RESEND_API_KEY not configured');
    return { success: true };
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://fuelrx.app';
  const mealPlanUrl = `${appUrl}/meal-plan/${mealPlanId}`;

  const subject = themeName
    ? `Your ${themeName} Meal Plan is Ready!`
    : 'Your Meal Plan is Ready!';

  const greeting = userName ? `Hi ${userName},` : 'Hi there,';

  try {
    const { error } = await client.emails.send({
      from: `Coach Hill's FuelRx <${FROM_EMAIL}>`,
      replyTo: REPLY_TO_EMAIL,
      to: [to],
      subject,
      html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f3f4f6;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f3f4f6; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <!-- Header -->
          <tr>
            <td style="background-color: #16a34a; padding: 32px 40px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 600;">
                Coach Hill's FuelRx
              </h1>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              <p style="margin: 0 0 16px; color: #374151; font-size: 16px; line-height: 1.5;">
                ${greeting}
              </p>
              <p style="margin: 0 0 24px; color: #374151; font-size: 16px; line-height: 1.5;">
                Great news! Your ${themeName ? `<strong>${themeName}</strong> ` : ''}meal plan has been generated and is ready to view.
              </p>

              <!-- CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding: 16px 0 32px;">
                    <a href="${mealPlanUrl}" style="display: inline-block; background-color: #16a34a; color: #ffffff; text-decoration: none; font-size: 16px; font-weight: 600; padding: 14px 32px; border-radius: 8px;">
                      View Your Meal Plan
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin: 0 0 16px; color: #6b7280; font-size: 14px; line-height: 1.5;">
                Your personalized 7-day meal plan includes:
              </p>
              <ul style="margin: 0 0 24px; padding-left: 20px; color: #6b7280; font-size: 14px; line-height: 1.8;">
                <li>Customized meals matched to your macro targets</li>
                <li>Detailed prep schedule to save you time</li>
                <li>Smart grocery list organized by store section</li>
              </ul>

              <p style="margin: 0; color: #6b7280; font-size: 14px; line-height: 1.5;">
                If you have any questions or feedback, just reply to this email!
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f9fafb; padding: 24px 40px; text-align: center; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0; color: #9ca3af; font-size: 12px;">
                Coach Hill's FuelRx — Fuel your training with personalized nutrition
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
      `.trim(),
      text: `${greeting}

Great news! Your ${themeName ? `${themeName} ` : ''}meal plan has been generated and is ready to view.

View your meal plan here: ${mealPlanUrl}

Your personalized 7-day meal plan includes:
- Customized meals matched to your macro targets
- Detailed prep schedule to save you time
- Smart grocery list organized by store section

If you have any questions or feedback, just reply to this email!

— Coach Hill's FuelRx`,
    });

    if (error) {
      console.error('[Email] Failed to send meal plan ready email:', error);
      return { success: false, error: error.message };
    }

    console.log('[Email] Meal plan ready email sent to:', to);
    return { success: true };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    console.error('[Email] Error sending email:', errorMessage);
    return { success: false, error: errorMessage };
  }
}
