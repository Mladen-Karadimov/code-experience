"""Create AWS DevEndpoint and NotebookInstances"""
import boto3
import sys

from awsglue.utils import getResolvedOptions

NOTEBOOK_TYPES = ['ml.t3.medium',
'ml.t3.large',
'ml.t3.xlarge',
'ml.t3.2xlarge',
'ml.m5.large',
'ml.m5.xlarge',
'ml.m5.2xlarge',
'ml.m5.4xlarge',
'ml.m5.8xlarge',
'ml.m5.12xlarge',
'ml.m5.16xlarge',
'ml.m5.24xlarge',
'ml.c5.large',
'ml.c5.xlarge',
'ml.c5.2xlarge',
'ml.c5.4xlarge',
'ml.c5.9xlarge',
'ml.c5.12xlarge',
'ml.c5.18xlarge',
'ml.c5.24xlarge',
'ml.p3.2xlarge',
'ml.p3.8xlarge',
'ml.p3.16xlarge',
'ml.g4dn.xlarge',
'ml.g4dn.2xlarge',
'ml.g4dn.4xlarge',
'ml.g4dn.8xlarge',
'ml.g4dn.12xlarge',
'ml.g4dn.16xlarge']

args = getResolvedOptions(sys.argv, ["region", "number_of_workers", "env", "nameSuffix", "notebook_type", "notebook_size"])
env = args["env"]
number_of_workers = args["number_of_workers"]
region = args["region"]
nameSuffix = args["nameSuffix"]
notebookType = args["notebook_type"]
notebookSize = args["notebook_size"]

if not notebookSize > 5 and notebookSize < 16384: # Validate notebookSize
    print(f"Wrong notebook_size - {notebookSize}. Must be between 5 and 16384.")
    sys.exit()

if not notebookType in NOTEBOOK_TYPES:
    print(f"Wrong notebook_type - {notebookSize}. Must be - {NOTEBOOK_TYPES}")
    sys.exit()

template_url=f"https://dummy-{env}.s3.{region}.amazonaws.com/cloudformation/GlueDevNotebook/glue-dev-notebook-together.yaml"


cfn = boto3.client('cloudformation', region_name=region)

glue = boto3.client('glue', region_name=region)
sagemaker = boto3.client('sagemaker', region_name=region)

try:
    # GetEndpoints Names:
    response = glue.get_dev_endpoints(
        MaxResults=50
    )
    devEndpointsNames = []
    for host in response['DevEndpoints']:
        suffix_tmp = host['EndpointName'].replace("GlueEndpoint-","")
        devEndpointsNames.append(suffix_tmp)
    print(devEndpointsNames)
    # Get Notebook Names
    response = sagemaker.list_notebook_instances(
        MaxResults=50,
    )
    notebookNames = []
    for host in response['NotebookInstances']:
        suffix_tmp = host['NotebookInstanceName'].replace('aws-glue-GlueNotebook-',"")
        notebookNames.append(suffix_tmp)
    print(notebookNames)
except Exception as e:
    print(str(e))


for counter in range(50):
    suffix = f"{nameSuffix}-{counter}"
    if suffix not in devEndpointsNames and suffix not in notebookNames:
        break

try:
    response = cfn.create_stack(
        StackName='GlueNotebook-' + suffix,
        TemplateURL=template_url,
        Parameters=[
            {
                'ParameterKey': 'NotebookName',
                'ParameterValue': f"GlueNotebook-{suffix}"
            },
            {
                'ParameterKey': 'DevEndpointName',
                'ParameterValue': f"GlueEndpoint-{suffix}"
            },
            {
                'ParameterKey': 'NumberOfNodes',
                'ParameterValue': f"{number_of_workers}"
            },
            {
                'ParameterKey': 'InstanceType',
                'ParameterValue': f"{notebookType}"
            },
            {
                'ParameterKey': 'InstanceSize',
                'ParameterValue': f"{notebookSize}"
            },
        ],
        Capabilities=['CAPABILITY_IAM'])
except Exception as e:
    print(str(e))
