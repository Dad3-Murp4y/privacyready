import boto3
import sys

s3 = boto3.resource('s3', region_name='ap-southeast-1') # Assuming region from previous terraform logs, but let's not assume, boto3 uses default.
# Better to rely on default session
for bucket in s3.buckets.all():
    if bucket.name.startswith("datawai-"):
        print(f"Wiping versions for {bucket.name}...")
        try:
            bucket.object_versions.delete()
            bucket.objects.delete()
        except Exception as e:
            print(f"Error wiping {bucket.name}: {e}")
