import os
import boto3
import email
from email.policy import default

s3 = boto3.client('s3')
ses = boto3.client('ses')

FORWARD_TO = os.environ.get('FORWARD_TO', 'all.datawai@gmail.com')
SENDER_DOMAIN = os.environ.get('SENDER_DOMAIN', 'privacyready.co.uk')

def lambda_handler(event, context):
    print("SES Event received:", event)
    try:
        ses_record = event['Records'][0]['ses']
        mail_info = ses_record['mail']
        message_id = mail_info['messageId']
        
        receipt = ses_record.get('receipt', {})
        s3_action = receipt.get('action', {})
        
        bucket_name = s3_action.get('bucketName', os.environ.get('S3_BUCKET_NAME'))
        object_key = s3_action.get('objectKey', f"inbound/{message_id}")
        
        print(f"Fetching raw email from s3://{bucket_name}/{object_key}...")
        s3_obj = s3.get_object(Bucket=bucket_name, Key=object_key)
        raw_email_bytes = s3_obj['Body'].read()
        
        msg = email.message_from_bytes(raw_email_bytes, policy=default)
        
        original_from = str(msg.get('From', ''))
        original_to = str(msg.get('To', ''))
        original_subject = str(msg.get('Subject', 'No Subject'))
        
        # Preserve original sender in Reply-To
        if 'Reply-To' in msg:
            del msg['Reply-To']
        msg['Reply-To'] = original_from
        
        # Change From header to forwarder@<domain> so SES SPF/DKIM verification passes
        if 'From' in msg:
            del msg['From']
        msg['From'] = f"PrivacyReady Forwarder <forwarder@{SENDER_DOMAIN}>"
        
        # Change To header
        if 'To' in msg:
            del msg['To']
        msg['To'] = FORWARD_TO
        
        # Modify Subject to show forwarding target/source
        if 'Subject' in msg:
            del msg['Subject']
        msg['Subject'] = f"[Fwd to {original_to}] {original_subject}"
        
        # Remove headers that cause validation/signing errors when re-sending
        for header in ['DKIM-Signature', 'Return-Path', 'Sender', 'Message-ID']:
            while header in msg:
                del msg[header]
            
        print(f"Sending forwarded email from forwarder@{SENDER_DOMAIN} to {FORWARD_TO}...")
        response = ses.send_raw_email(
            Source=f"forwarder@{SENDER_DOMAIN}",
            Destinations=[FORWARD_TO],
            RawMessage={'Data': msg.as_bytes()}
        )
        
        print(f"Successfully forwarded email! SES MessageId: {response['MessageId']}")
        
        # Delete temporary S3 object
        try:
            s3.delete_object(Bucket=bucket_name, Key=object_key)
            print(f"Deleted S3 object {object_key}")
        except Exception as e:
            print(f"Warning: Could not delete S3 object: {e}")
            
        return {'statusCode': 200, 'body': 'Forwarded successfully'}
    except Exception as err:
        print(f"Error forwarding email: {err}")
        raise err
