import boto3
import json
import os
import logging
from botocore.exceptions import ClientError

log = logging.getLogger("ecs_get_secrets")
logging.basicConfig()
log.setLevel(logging.INFO)

def get_secret():
    secret_name = os.getenv("AWS_SECRET_NAME_CONFIG")
    region_name = os.getenv("AWS_REGION","ap-south-1")

    try:
        session = boto3.session.Session()
    except ClientError as e:
        log.error(e)
    try:
        client = session.client(
            service_name='secretsmanager',
            region_name=region_name,
        )
    except ClientError as e:
        log.error(e) 

    try:
        get_secret_value_response = client.get_secret_value(
            SecretId=secret_name
        )
    except ClientError as e:
        log.error("FAIL Processing - {}".format(e))
    else:
        # Secrets Manager decrypts the secret value using the associated KMS CMK
        # Depending on whether the secret was a string or binary, only one of these fields will be populated
        if 'SecretString' in get_secret_value_response:
            text_secret_data = get_secret_value_response['SecretString']
            log.info("Loading  " + secret_name + " to .env file.")
            try:
                aws_secrets_as_json = json.loads(text_secret_data)
            except ClientError as e:
                log.error("FAIL Parsing - {}".format(e))

            env_file = open(".env", "w")
            for key in aws_secrets_as_json:
                env_file.write("{}={}\n".format(key,aws_secrets_as_json[key]))

            env_file.close            
        else:
            binary_secret_data = get_secret_value_response['SecretBinary']

get_secret()