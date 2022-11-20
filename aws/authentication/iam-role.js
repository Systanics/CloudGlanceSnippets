#!/usr/bin/env node
const aws = require('aws-sdk');
const os = require('os');
const inquirer = require('inquirer');
const shell = require('shelljs'); // If typings are not correct in Jetbrains https://github.com/shelljs/shelljs/issues/859#issuecomment-892615449

async function main()
{
  /* === Get Inputs from User amd the existing AWS profile === */
  const profilePrompt = await inquirer.prompt([{
    type: 'input',
    name: 'sourceProfile',
    message: 'Source Profile',
  }]);

  const sourceProfileName = profilePrompt.sourceProfile;
  const mfaArn = shell.exec("aws configure get mfa_serial --profile "+sourceProfileName, {silent: true}).stdout.replaceAll(os.EOL, '');
  const region = shell.exec("aws configure get region --profile "+sourceProfileName, {silent: true}).stdout.replaceAll(os.EOL, '');
  const externalId = shell.exec("aws configure get external_id --profile "+sourceProfileName, {silent: true}).stdout.replaceAll(os.EOL, '');
  const assumeRoleArn = shell.exec("aws configure get role_arn --profile "+sourceProfileName, {silent: true}).stdout.replaceAll(os.EOL, '');
  const assumeRoleFromProfile = shell.exec("aws configure get source_profile --profile "+sourceProfileName, {silent: true}).stdout.replaceAll(os.EOL, '');

  /* Only ask for an MFA code if we have `mfa_serial` set on the profile  */
  let mfaCode = undefined;
  if(mfaArn)
  {
    const mfaCodePrompt = await inquirer.prompt([{
      type: 'input',
      name: 'mfaCode',
      message: 'MFA Code',
    }]);
    mfaCode = mfaCodePrompt.mfaCode;
  }

  const profileSource = {
    name: sourceProfileName,
    region: region,
    mfaArn: !!mfaArn ? mfaArn : undefined,
    mfaCode: mfaCode,
    externalId: !!externalId ? externalId : undefined,
    assumeRoleArn: assumeRoleArn,
    assumeRoleFromProfile: assumeRoleFromProfile,
  };
  const profileTarget = {
    name: profileSource.name+'-temporary',
    roleSessionName: profileSource.name + "." + profileSource.assumeRoleArn.split('/').slice(-1) // Can be anything descriptive
  };

  /* If MFA is required, we need to first get a temporary session that has the MFA flag set, then assume role */
  let awsAssumeRoleCred;
  if(!profileSource.mfaArn)
    awsAssumeRoleCred = new aws.SharedIniFileCredentials({profile: profileSource.assumeRoleFromProfile});
  else
  {
    const awsCredentials = new aws.SharedIniFileCredentials({profile: profileSource.assumeRoleFromProfile});
    const sts = new aws.STS({
      credentials: awsCredentials,
      endpoint: "https://sts."+profileSource.region+".amazonaws.com",
      region: profileSource.region
    });

    // const tokenDuration = 43200;
    const stsMfaSessions = await sts.getSessionToken({
      // DurationSeconds: tokenDuration,
      SerialNumber: profileSource.mfaArn,
      TokenCode: profileSource.mfaCode
    }).promise();

    awsAssumeRoleCred = new aws.Credentials({
      accessKeyId: stsMfaSessions.Credentials.AccessKeyId,
      secretAccessKey: stsMfaSessions.Credentials.SecretAccessKey,
      sessionToken: stsMfaSessions.Credentials.SessionToken,
    });
  }

  const stsSession = new aws.STS({
    credentials: awsAssumeRoleCred,
    endpoint: "https://sts."+profileSource.region+".amazonaws.com",
    region: profileSource.region
  });
  const stsAssumeRoleCredentials = await stsSession.assumeRole({
    /* Defaults to 1 hour (3600 seconds), can be more depending on role maximum but not more than 1 hour if role chaining with MFA */
    // DurationSeconds: 43200,
    RoleSessionName: profileTarget.roleSessionName,
    RoleArn: profileSource.assumeRoleArn,
    ExternalId: profileSource.externalId
  }).promise();

  shell.exec(`aws configure set region ${profileSource.region} --profile `+profileTarget.name);
  shell.exec(`aws configure set aws_access_key_id ${stsAssumeRoleCredentials.Credentials.AccessKeyId} --profile `+profileTarget.name);
  shell.exec(`aws configure set aws_secret_access_key ${stsAssumeRoleCredentials.Credentials.SecretAccessKey} --profile `+profileTarget.name);
  shell.exec(`aws configure set aws_session_token ${stsAssumeRoleCredentials.Credentials.SessionToken} --profile `+profileTarget.name);

  console.log("Successfully set AWS Profile: "+profileTarget.name);
  console.log("Expires at: "+stsAssumeRoleCredentials.Credentials.Expiration);
}
main().catch(err => console.error(err));
