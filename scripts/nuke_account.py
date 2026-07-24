#!/usr/bin/env python3
import boto3
import time

REGION = 'eu-west-2'

# Clients
s3 = boto3.resource('s3', region_name=REGION)
s3_client = boto3.client('s3', region_name=REGION)
acm_eu = boto3.client('acm', region_name=REGION)
acm_us = boto3.client('acm', region_name='us-east-1')
r53 = boto3.client('route53', region_name=REGION)
ses = boto3.client('ses', region_name=REGION)
ec2 = boto3.client('ec2', region_name=REGION)
ec2_res = boto3.resource('ec2', region_name=REGION)

def purge_s3():
    print("Purging S3 Buckets...")
    for bucket in s3.buckets.all():
        print(f"  Emptying and deleting {bucket.name}...")
        try:
            bucket.object_versions.delete()
            bucket.objects.delete()
            bucket.delete()
        except Exception as e:
            print(f"  Failed: {e}")

def purge_acm(client, region_name):
    print(f"Purging ACM Certificates in {region_name}...")
    try:
        certs = client.list_certificates()['CertificateSummaryList']
        for cert in certs:
            print(f"  Deleting {cert['DomainName']} ({cert['CertificateArn']})")
            client.delete_certificate(CertificateArn=cert['CertificateArn'])
    except Exception as e:
        print(f"  Failed: {e}")

def purge_ses():
    print("Purging SES Identities...")
    try:
        ids = ses.list_identities()['Identities']
        for i in ids:
            print(f"  Deleting {i}")
            ses.delete_identity(Identity=i)
    except Exception as e:
        print(f"  Failed: {e}")

def purge_route53():
    print("Purging Route 53 Zones...")
    try:
        zones = r53.list_hosted_zones()['HostedZones']
        for z in zones:
            zone_id = z['Id']
            print(f"  Cleaning zone {z['Name']} ({zone_id})...")
            
            # Disable DNSSEC
            try:
                r53.disable_hosted_zone_dnssec(HostedZoneId=zone_id)
                time.sleep(2)
                ksks = r53.get_dnssec(HostedZoneId=zone_id).get('KeySigningKeys', [])
                for k in ksks:
                    print(f"    Deactivating KSK {k['Name']}...")
                    r53.deactivate_key_signing_key(HostedZoneId=zone_id, Name=k['Name'])
                    time.sleep(2)
                    print(f"    Deleting KSK {k['Name']}...")
                    r53.delete_key_signing_key(HostedZoneId=zone_id, Name=k['Name'])
            except Exception as e:
                pass
                
            # Delete records
            try:
                records = r53.list_resource_record_sets(HostedZoneId=zone_id)['ResourceRecordSets']
                changes = []
                for r in records:
                    if r['Type'] not in ['NS', 'SOA']:
                        changes.append({'Action': 'DELETE', 'ResourceRecordSet': r})
                if changes:
                    r53.change_resource_record_sets(HostedZoneId=zone_id, ChangeBatch={'Changes': changes})
            except Exception as e:
                print(f"    Error deleting records: {e}")
                
            # Delete zone
            time.sleep(2)
            try:
                r53.delete_hosted_zone(Id=zone_id)
                print(f"  Deleted zone {z['Name']}.")
            except Exception as e:
                print(f"  Failed to delete zone: {e}")
    except Exception as e:
        print(f"  Failed: {e}")

def purge_vpcs():
    print("Purging Custom VPCs...")
    vpcs = ec2_res.vpcs.all()
    for vpc in vpcs:
        if vpc.is_default:
            continue
        print(f"  Cleaning VPC {vpc.id}...")
        
        # 1. Delete NAT Gateways
        nats = ec2.describe_nat_gateways(Filters=[{'Name': 'vpc-id', 'Values': [vpc.id]}])['NatGateways']
        for nat in nats:
            if nat['State'] != 'deleted':
                print(f"    Deleting NAT Gateway {nat['NatGatewayId']}...")
                ec2.delete_nat_gateway(NatGatewayId=nat['NatGatewayId'])
                
        # Wait for NATs to delete
        while True:
            nats = ec2.describe_nat_gateways(Filters=[{'Name': 'vpc-id', 'Values': [vpc.id]}])['NatGateways']
            active_nats = [n for n in nats if n['State'] not in ['deleted', 'failed']]
            if not active_nats:
                break
            print("    Waiting for NAT Gateways to delete...")
            time.sleep(10)
            
        # 2. Delete Endpoints
        endpoints = ec2.describe_vpc_endpoints(Filters=[{'Name': 'vpc-id', 'Values': [vpc.id]}])['VpcEndpoints']
        for ep in endpoints:
            print(f"    Deleting VPC Endpoint {ep['VpcEndpointId']}...")
            ec2.delete_vpc_endpoints(VpcEndpointIds=[ep['VpcEndpointId']])
            
        # 3. Detach and delete IGWs
        for igw in vpc.internet_gateways.all():
            print(f"    Detaching & Deleting IGW {igw.id}...")
            vpc.detach_internet_gateway(InternetGatewayId=igw.id)
            igw.delete()
            
        # 4. Delete Subnets
        for subnet in vpc.subnets.all():
            print(f"    Deleting Subnet {subnet.id}...")
            try:
                subnet.delete()
            except Exception as e:
                print(f"    Error deleting subnet: {e}")
                
        # 5. Delete Route Tables
        for rt in vpc.route_tables.all():
            is_main = False
            for assoc in rt.associations:
                if assoc.main:
                    is_main = True
            if not is_main:
                print(f"    Deleting Route Table {rt.id}...")
                try:
                    rt.delete()
                except Exception as e:
                    pass
                    
        # 6. Delete Security Groups
        for sg in vpc.security_groups.all():
            if sg.group_name != 'default':
                print(f"    Deleting Security Group {sg.id}...")
                try:
                    sg.delete()
                except Exception as e:
                    pass
                    
        # 7. Delete VPC
        print(f"    Deleting VPC {vpc.id}...")
        try:
            vpc.delete()
            print(f"  VPC {vpc.id} successfully deleted.")
        except Exception as e:
            print(f"  Failed to delete VPC {vpc.id}: {e}")

def release_eips():
    print("Releasing Elastic IPs...")
    eips = ec2.describe_addresses()['Addresses']
    for eip in eips:
        if 'AssociationId' not in eip: # Only unassociated EIPs
            print(f"  Releasing EIP {eip['PublicIp']}...")
            ec2.release_address(AllocationId=eip['AllocationId'])

def main():
    purge_s3()
    purge_acm(acm_eu, REGION)
    purge_acm(acm_us, 'us-east-1')
    purge_route53()
    purge_ses()
    purge_vpcs()
    release_eips()
    print("Total Account Purge Complete.")

if __name__ == '__main__':
    main()
