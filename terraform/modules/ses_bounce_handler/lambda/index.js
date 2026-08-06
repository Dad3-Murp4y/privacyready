const { Client } = require('pg');

exports.handler = async (event) => {
  console.log('Received event:', JSON.stringify(event, null, 2));

  // The DB password and host will be passed as environment variables
  const client = new Client({
    connectionString: process.env.DATABASE_URL
  });

  await client.connect();

  try {
    for (const record of event.Records) {
      const snsMessage = JSON.parse(record.Sns.Message);
      const notificationType = snsMessage.notificationType;

      if (notificationType === 'Bounce') {
        const bounce = snsMessage.bounce;
        if (bounce.bounceType === 'Permanent') {
          for (const bouncedRecipient of bounce.bouncedRecipients) {
            const email = bouncedRecipient.emailAddress;
            const detail = bouncedRecipient.diagnosticCode || bounce.bounceSubType;
            
            console.log(`Recording permanent bounce for ${email}`);
            await client.query(`
              INSERT INTO "SuppressionList" (email, reason, detail, "createdAt")
              VALUES ($1, $2, $3, NOW())
              ON CONFLICT (email) DO UPDATE SET reason = $2, detail = $3, "createdAt" = NOW()
            `, [email, 'BOUNCE', detail]);
          }
        }
      } else if (notificationType === 'Complaint') {
        const complaint = snsMessage.complaint;
        for (const complainedRecipient of complaint.complainedRecipients) {
          const email = complainedRecipient.emailAddress;
          const detail = complaint.complaintFeedbackType || 'complaint';
          
          console.log(`Recording complaint for ${email}`);
          await client.query(`
            INSERT INTO "SuppressionList" (email, reason, detail, "createdAt")
            VALUES ($1, $2, $3, NOW())
            ON CONFLICT (email) DO UPDATE SET reason = $2, detail = $3, "createdAt" = NOW()
          `, [email, 'COMPLAINT', detail]);
        }
      }
    }
  } catch (error) {
    console.error('Error processing SES notification:', error);
    throw error;
  } finally {
    await client.end();
  }

  return { statusCode: 200, body: 'Success' };
};
