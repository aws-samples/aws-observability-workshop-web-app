import os
import json
import boto3
from botocore.exceptions import ClientError
s3client = boto3.client('s3')
s3resource = boto3.resource('s3')

import logging
logger = logging.getLogger()
logger.setLevel(logging.INFO)

def on_event(event, context):
  logger.info("Received event: %s" % json.dumps(event))
  request_type = event['RequestType']
  if request_type == 'Create': return on_create(event)
  if request_type == 'Update': return on_create(event)
  if request_type == 'Delete': return on_delete(event)
  raise Exception("Invalid request type: %s" % request_type)

def on_create(event):
  source_bucket = event['ResourceProperties']['SourceBucket']
  source_prefix = event['ResourceProperties'].get('SourcePrefix') or ''
  bucket = event['ResourceProperties']['Bucket']
  prefix = event['ResourceProperties'].get('Prefix') or ''
  
  userPoolId = event['ResourceProperties']['UserPool']
  clientId = event['ResourceProperties']['Client']
  region = event['ResourceProperties']['Region']
  restapi = event['ResourceProperties']['RestApi']
  try:
    copy_objects(source_bucket, source_prefix, bucket, prefix)
    update_config(userPoolId, clientId, region, bucket, restapi)
  except ClientError as e:
    logger.error('Error: %s', e)
    raise e
  return

def on_delete(event):
  bucket = event['ResourceProperties']['Bucket']
  prefix = event['ResourceProperties'].get('Prefix') or ''
  try:
    delete_objects(bucket, prefix)
  except ClientError as e:
    logger.error('Error: %s', e)
    raise e
  return

def copy_objects(source_bucket, source_prefix, bucket, prefix):
  paginator = s3client.get_paginator('list_objects_v2')
  page_iterator = paginator.paginate(Bucket=source_bucket, Prefix=source_prefix)
  for key in {x['Key'] for page in page_iterator for x in page['Contents']}:
    dest_key = os.path.join(prefix, os.path.relpath(key, source_prefix))
    if not key.endswith('/'):
      #logger.info("copy %s to %s".format(key, dest_key))
      s3client.copy_object(CopySource={'Bucket': source_bucket, 'Key': key}, Bucket=bucket, Key = dest_key)
  return

def delete_objects(bucket, prefix):
  paginator = s3client.get_paginator('list_objects_v2')
  page_iterator = paginator.paginate(Bucket=bucket, Prefix=prefix)
  objects = [{'Key': x['Key']} for page in page_iterator for x in page['Contents']]
  s3client.delete_objects(Bucket=bucket, Delete={'Objects': objects})
  return

def update_config(userPoolId, clientId, region, bucket, restapi): 
  s3resource.Object(bucket, 'js/config.js')
  config_content = """
    var _config = {
        cognito: {
            userPoolId: '%s', // e.g. us-east-2_uXboG5pAb
            userPoolClientId: '%s', // e.g. 25ddkmj4v6hfsfvruhpfi7n4hv
            region: '%s', // e.g. us-east-2
        },
        api: {
            invokeUrl: '%s', // e.g. https://rc7nyt4tql.execute-api.us-west-2.amazonaws.com/prod'
        }
    };
    """
  config_content = config_content % (userPoolId, clientId, region, restapi)
  config = s3resource.Object(bucket,'js/config.js')
  config.put(Body=config_content)
  return