import fetch from 'node-fetch';

async function testSecurity() {
  console.log('Testing /auth/register with MALICIOUS payload (Invalid Email format + Short Password)...');
  
  const badRes = await fetch('http://localhost:8080/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'not-an-email<script>alert(1)</script>',
      password: '123', // Too short
      fullName: 'A', // Too short
      organizationName: 'BadOrg'
    })
  });
  
  const badJson = await badRes.json();
  console.log(`Status: ${badRes.status}`);
  console.log('Response:', JSON.stringify(badJson, null, 2));

  console.log('\n---------------------------\n');

  console.log('Testing /auth/register with VALID payload...');
  const goodRes = await fetch('http://localhost:8080/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'admin@privacyready.com',
      password: 'SuperSecurePassword!123',
      fullName: 'Admin User',
      organizationName: 'PrivacyReady Test Corp'
    })
  });
  
  const goodJson = await goodRes.json();
  console.log(`Status: ${goodRes.status}`);
  console.log('Response:', JSON.stringify(goodJson, null, 2));

}

testSecurity().catch(console.error);
