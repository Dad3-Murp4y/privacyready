#!/usr/bin/env python3
import boto3
import time

REGION = 'eu-west-2'
PROJECT = 'privacyready'

ec2 = boto3.client('ec2', region_name=REGION)
rds = boto3.client('rds', region_name=REGION)
ec_client = boto3.client('elasticache', region_name=REGION)
ecr = boto3.client('ecr', region_name=REGION)
elbv2 = boto3.client('elbv2', region_name=REGION)
route53 = boto3.client('route53', region_name=REGION)
s3 = boto3.client('s3', region_name=REGION)

def has_project_tag(tags_list):
    if not tags_list: return False
    for t in tags_list:
        if isinstance(t, dict):
            if t.get('Key') == 'Project' and t.get('Value') == PROJECT: return True
    return False

def clean_route53():
    print("Cleaning Route53...")
    zones = route53.list_hosted_zones()['HostedZones']
    for z in zones:
        if PROJECT in z['Name']:
            zone_id = z['Id']
            print(f"Deleting records in zone {zone_id}")
            records = route53.list_resource_record_sets(HostedZoneId=zone_id)['ResourceRecordSets']
            changes = []
            for r in records:
                if r['Type'] not in ['NS', 'SOA']:
                    changes.append({'Action': 'DELETE', 'ResourceRecordSet': r})
            if changes:
                route53.change_resource_record_sets(HostedZoneId=zone_id, ChangeBatch={'Changes': changes})
                print(f"Deleted {len(changes)} records.")
            
            print(f"Deleting hosted zone {zone_id}")
            try:
                route53.delete_hosted_zone(Id=zone_id)
            except Exception as e:
                print(f"Error: {e}")

def clean_ec2():
    print("Terminating EC2 instances...")
    instances = ec2.describe_instances(Filters=[{'Name': f'tag:Project', 'Values': [PROJECT]}])
    instance_ids = [i['InstanceId'] for r in instances['Reservations'] for i in r['Instances'] if i['State']['Name'] not in ['terminated', 'shutting-down']]
    if instance_ids:
        print(f"Terminating {instance_ids}")
        ec2.terminate_instances(InstanceIds=instance_ids)
        waiter = ec2.get_waiter('instance_terminated')
        waiter.wait(InstanceIds=instance_ids)
        print("Instances terminated.")

def clean_rds():
    print("Deleting RDS instances...")
    dbs = rds.describe_db_instances()['DBInstances']
    for db in dbs:
        if PROJECT in db['DBInstanceIdentifier']:
            print(f"Deleting RDS {db['DBInstanceIdentifier']}")
            try:
                rds.delete_db_instance(DBInstanceIdentifier=db['DBInstanceIdentifier'], SkipFinalSnapshot=True)
            except Exception as e:
                print(e)

def clean_elasticache():
    print("Deleting ElastiCache...")
    clusters = ec_client.describe_replication_groups()['ReplicationGroups']
    for c in clusters:
        if PROJECT in c['ReplicationGroupId']:
            print(f"Deleting Redis {c['ReplicationGroupId']}")
            try:
                ec_client.delete_replication_group(ReplicationGroupId=c['ReplicationGroupId'], RetainPrimaryCluster=False)
            except Exception as e:
                print(e)

def clean_ecr():
    print("Deleting ECR...")
    repos = ecr.describe_repositories()['repositories']
    for r in repos:
        if PROJECT in r['repositoryName']:
            print(f"Deleting repo {r['repositoryName']}")
            try:
                ecr.delete_repository(repositoryName=r['repositoryName'], force=True)
            except Exception as e:
                print(e)

def clean_albs():
    print("Deleting ALBs...")
    albs = elbv2.describe_load_balancers()['LoadBalancers']
    for alb in albs:
        tags = elbv2.describe_tags(ResourceArns=[alb['LoadBalancerArn']])['TagDescriptions'][0]['Tags']
        if has_project_tag(tags):
            print(f"Deleting ALB {alb['LoadBalancerArn']}")
            try:
                elbv2.delete_load_balancer(LoadBalancerArn=alb['LoadBalancerArn'])
            except Exception as e:
                print(e)
                
    time.sleep(5)
    tgs = elbv2.describe_target_groups()['TargetGroups']
    for tg in tgs:
        if PROJECT in tg['TargetGroupArn']:
            print(f"Deleting Target Group {tg['TargetGroupArn']}")
            try:
                elbv2.delete_target_group(TargetGroupArn=tg['TargetGroupArn'])
            except Exception as e:
                print(e)

def main():
    clean_ec2()
    clean_albs()
    clean_rds()
    clean_elasticache()
    clean_ecr()
    clean_route53()
    print("Cleanup initiated. (Note: VPCs and SGs require manual cleanup if needed)")

if __name__ == '__main__':
    main()
