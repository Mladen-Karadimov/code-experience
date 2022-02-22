import boto3
import os
import time
import logging
import mysql.connector
import json

from botocore.config import Config
from urllib.parse import unquote_plus

logger = logging.getLogger()
logger.setLevel(logging.INFO)

aws_region = "eu-central-1"
database = "wallet"
table_name = "transaction"
rds_password_parameter = "/data_pipelines/rds_aws_glue_password"
rds_jdbc_url_parameter = f"/data_pipelines/jdbc/{database}"

def mysql_connect():
    ssm = boto3.client('ssm', region_name=aws_region)
    jdbc = ssm.get_parameter( Name=rds_jdbc_url_parameter )["Parameter"]["Value"]
    database_user = "aws_glue"
    database_host = jdbc.split("/")[2].split(':')[0]
    database_name = database
    database_password = ssm.get_parameter( Name=rds_password_parameter, WithDecryption=True )["Parameter"]["Value"]

    logger.info("Atemp to connect to database.")

    try:
        conn = mysql.connector.connect(host=database_host, user=database_user, passwd=database_password, db=database_name, connect_timeout=5)
    except Exception as e:
        logger.error("Database connection failed due to {}".format(e))
        exit(1)

    logger.info("SUCCESS: Connection to RDS MySQL instance succeeded")
    return conn

def mysql_execute_query(conn):
    try:
        cur = conn.cursor()
        cur.execute(f"""select month(created_date), count(*) from {table_name} where YEAR(created_date)=2021 group by month(created_date)""")
        query_results = cur.fetchall()
        logger.info(query_results)
    except Exception as e:
        logger.error("Query execution failed due to {}".format(e))

def lambda_handler(event, context):
    # TODO implement
    logger.info("Start")
    rds_connection = mysql_connect()
    mysql_execute_query(rds_connection)

    logger.error("After")
    return {
        'statusCode': 200,
        'body': json.dumps('Hello from Lambda!')
    }