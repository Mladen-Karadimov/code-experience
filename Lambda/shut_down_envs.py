import os
import boto3
from botocore.vendored import requests
import urllib3
import json

asg_client = boto3.client('autoscaling')
route53_client = boto3.client('route53')
rds_client = boto3.client('rds')
app_asg_client = boto3.client('application-autoscaling')
ecs_client = boto3.client('ecs')

slack_webhook_url = "https://hooks.slack.com/services/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"
slack_payload_on = {"text": ":fireworks: DEV (" + os.environ['NAMES'] + ") environments are now started! :fireworks:"}
slack_payload_warn = {"text": ":warning: DEV environments will be stopped in 15 minutes! :warning:\n <!here> "}
slack_payload_off = {"text": ":money_with_wings: DEV (" + os.environ['NAMES'] + ") environments are now stopped! :money_with_wings:"}

def get_env_variable(var_name):
    msg = "Set the %s environment variable"
    try:
        return os.environ[var_name]
    except KeyError:
        error_msg = msg % var_name
        
def rds_management(action, client):
    rds_instance = client + "-postgres"
    if action == "start":
        response = rds_client.start_db_instance(
            DBInstanceIdentifier=rds_instance
        )
    elif action == "stop":
        response = rds_client.stop_db_instance(
            DBInstanceIdentifier=rds_instance
        )
    print ("RDS response:")
    print (response)
        
def asg_management(action, client):
    group = client + "-backend-asg"
    if action == "start":
        min_size = int(get_env_variable('MIN_SIZE'))
        max_size = int(get_env_variable('MAX_SIZE'))
        desired_capacity = int(get_env_variable('DESIRED_CAPACITY'))
    elif action == "stop":
        min_size = 0
        max_size = 0
        desired_capacity = 0
    
    response = asg_client.update_auto_scaling_group(
        AutoScalingGroupName=group,
        MinSize=min_size,
        MaxSize=max_size,
        DesiredCapacity=desired_capacity,
    )
    print ("ASG response:")
    print (response)

def app_asg_management(action, client):
    
    cluster = client + "-keycloak-ecs-cluster"
    service = client + "-keycloak-ecs-service"
    if action == "start":
        min_size = int(get_env_variable('MIN_SIZE'))
        max_size = int(get_env_variable('MAX_SIZE'))
        suspended = False
    elif action == "stop":
        min_size = 0
        max_size = 0
        suspended = True
    
    response = app_asg_client.register_scalable_target(
        ServiceNamespace='ecs',
        ResourceId=f"service/{cluster}/{service}",
        ScalableDimension='ecs:service:DesiredCount',
        MinCapacity=min_size,
        MaxCapacity=max_size,
        SuspendedState={
            'DynamicScalingInSuspended': False,
            'DynamicScalingOutSuspended': suspended,
            'ScheduledScalingSuspended': suspended
        }
    )
    print ("ECS ASG response:")
    print (response)

def healthcheck_management(action, client):
    isDisabled = False if action == "start" else True
    
    #get healthcheckID
    health_checks = route53_client.list_health_checks()
    for health_check in health_checks['HealthChecks']:
        if health_check['HealthCheckConfig']['FullyQualifiedDomainName'] == client + ".dummy.org":
            health_check_id = health_check['Id']
    
    #manage the healthcheck
    response = route53_client.update_health_check(
        HealthCheckId=health_check_id,
        Disabled=isDisabled
    )
    print ("HealthCheck Response:")
    print (response)

def ecs_management(action, client):

    if action == "start":
        count = 1
    elif action == "stop":
        count = 0

    #superset
    ecs_cluster = client + "-superset-ecs-cluster"
    ecs_service = client + "-superset-ecs-service"
    
    response = ecs_client.update_service(
        cluster=ecs_cluster,
        service=ecs_service,
        desiredCount=count
    )
    print("Supperset Managed!")
    
    #posthog
    ecs_cluster = client + "-posthog-ecs-cluster"
    ecs_service = client + "-posthog-ecs-service"
    try:
        response = ecs_client.update_service(
            cluster=ecs_cluster,
            service=ecs_service,
            desiredCount=count
        )
        print("PostHog Managed!")
    except:
        print ("No PostHog cluster avaliabe.")
      
        

def notify_slack(payload):
    print(json.dumps(payload))
    http = urllib3.PoolManager()
    response = http.request('POST',
                        slack_webhook_url,
                        body = json.dumps(payload),
                        headers = {'Content-Type': 'application/json'},
                        retries = False)
    print ("Slack Notification Response:")
    print (response)   
        
    
def lambda_handler(event, context):
    clientAll = get_env_variable('NAMES').split(',')

    try:
        service = event['service']
        action = event['action']
        if action != "start" and action != "stop" and action != "warn":
            raise Exception("Invalid action. Should be - start/stop/warn")
    except Exception as e:
        raise e
        
    if service == "all" and action == "warn":
        notify_slack(slack_payload_warn)
    else:
        for clientName in clientAll:
            print("Service: " + service)
            print(action + ": " + clientName)

            if service == "rds":
                rds_management(action, clientName)
            elif service == "asg":
                asg_management(action, clientName)
                app_asg_management(action, clientName)
                ecs_management(action, clientName)
            elif service == "healthcheck":
                healthcheck_management(action, clientName)
            elif service == "all" and action == "stop":
                healthcheck_management(action, clientName)
                asg_management(action, clientName)
                app_asg_management(action, clientName)
                ecs_management(action, clientName)
                rds_management(action, clientName)
            else:
                raise Exception("Invalid service. Should be - rds/asg/healthcheck/all, where all is avaliable only for action: stop")
        if service == "all" and action == "stop":
            notify_slack(slack_payload_off)
        elif service == "healthcheck" and action == "start":
            notify_slack(slack_payload_on)
