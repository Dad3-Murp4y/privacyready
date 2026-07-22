#!/usr/bin/env python3
"""
DESTRUCTIVE: permanently empties every S3 bucket whose name starts with
"privacyready-" (all objects and all versions), across every bucket in
the account reachable by your default AWS credentials.

This exists to empty versioned buckets before `terraform destroy` can
remove them (Terraform can't delete a non-empty bucket). It is not part
of normal operation -- only run this when you specifically intend to
tear down an environment.

Usage:
    python3 wipe_bucket.py --yes
"""
import boto3
import sys

if '--yes' not in sys.argv:
    print("This will PERMANENTLY delete all objects and versions in every")
    print("privacyready-* S3 bucket visible to your current AWS credentials.")
    print()
    print("Re-run with --yes to confirm: python3 wipe_bucket.py --yes")
    sys.exit(1)

s3 = boto3.resource('s3')  # uses default AWS credential chain / region

matching = [b for b in s3.buckets.all() if b.name.startswith("privacyready-")]

if not matching:
    print("No privacyready-* buckets found. Nothing to do.")
    sys.exit(0)

print("About to wipe the following buckets:")
for bucket in matching:
    print(f"  - {bucket.name}")
print()

for bucket in matching:
    print(f"Wiping versions for {bucket.name}...")
    try:
        bucket.object_versions.delete()
        bucket.objects.delete()
    except Exception as e:
        print(f"Error wiping {bucket.name}: {e}")

print("Done.")
