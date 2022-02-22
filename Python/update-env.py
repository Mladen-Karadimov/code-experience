import checksumdir
import hashlib
import boto3
import glob
import jenkins
import time
import os
import sys


ci_jenkins_url = "https://jenkins.dymmy.com/"
username = "mladen.karadimov"

try:  
   token = os.environ["JENKINS_API_KEY"]
except KeyError: 
   print("Please set the environment variable JENKINS_API_KEY")
   sys.exit(1)

job = "environment-update"
j = jenkins.Jenkins(ci_jenkins_url, username=username, password=token)
jenkins_build_numbers = {}

dynamodb = boto3.resource('dynamodb')
table = dynamodb.Table('dymmy-environments-hash')

def check_environment_for_update(env, new_hash):
    try:
        key = {}
        key['environment'] = env
        response = table.get_item(Key=key)['Item']['environment']
    except:
        print("Environment {} is missing from table. - skip".format(env))
        return False

    current_hash = table.get_item(Key=key)['Item']['hash']
    # current_frontend_hash = table.get_item(Key=key)['Item']['frontend']
    if current_hash != new_hash:
        # if current_frontend_hash != hash_local_frontend:
        #     update_type = 'all'
        # else
        #     update_type = 'backend'
        return True
    else:
        return False

def start_jobs(env):
    print("Starting {} job for {}..".format(job, env))

    client_name = env.split('-')[0]
    stage = env.split('-')[1]

    queue_number = j.build_job(job, {'token': token, 'ClientName': client_name, 'Stage': stage, 'update': 'all'})
    while j.get_queue_item(queue_number)['why'] != None:
        print("Waiting to start..")
        time.sleep(2)

    build_number = j.get_queue_item(queue_number)['executable']['number']
    build_url = j.get_queue_item(queue_number)['executable']['url']
    print("build url: {}".format(build_url))
    
    jenkins_build_numbers[env] = build_number

def wait_build_jobs():
    print("Waiting for build jobs..")
    running_jobs = len(jenkins_build_numbers)
    temp_jenkins_build_numbers = jenkins_build_numbers
    if running_jobs > 0:
        for build_environment, build_number in temp_jenkins_build_numbers.items():
            time.sleep(30)
            building = j.get_build_info(job, build_number)['building']
            print("{} - #{} building: {}".format(build_environment, build_number, building))

            if not building:
                result = j.get_build_info(job, build_number)['result']
                print("{} - {}".format(build_environment, result))
                build_url = "{}/job/{}/{}/console".format(ci_jenkins_url,job,build_number)
                print("Job URL: {}".format(build_url))
                running_jobs -= 1
                job_finish_status(build_environment, result)
                jenkins_build_numbers.pop(build_environment)
                break

    if running_jobs > 0:
        wait_build_jobs()

def job_finish_status(env, result):
    if result == 'SUCCESS':
        item = {}
        item['environment'] = env
        item['hash'] = hash_local[env]
        table.put_item(Item=item)
    else:
        item = {}
        item['environment'] = env
        item['hash'] = "failed"
        table.put_item(Item=item)

hash_local = {}
environments = glob.glob("./environments/*")
for env_path in environments:
    env = env_path.split('/')[-1]

    hash_local[env] = checksumdir.dirhash(env_path)

    hash_local_frontend_path = env_path + "/frontend.properties"
    hash_local_frontend = hashlib.md5(open(hash_local_frontend_path,'rb').read()).hexdigest()

    # update_type = None
    update_environment = check_environment_for_update(env, hash_local[env])
    if update_environment:
        start_jobs(env)
    print(update_environment)

wait_build_jobs()