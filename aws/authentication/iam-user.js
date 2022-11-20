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
    mfaCode: mfaCode
  };
  const profileTarget = {
    name: profileSource.name+'-temporary',
  };

  /* === Call AWS STS to get temporary credentials === */
  let awsCredentials = new aws.SharedIniFileCredentials({profile: profileSource.name});
  let sts = new aws.STS({
    credentials: awsCredentials,
    endpoint: "https://sts."+profileSource.region+".amazonaws.com",
    region: profileSource.region
  });

  let stsMfaSessions = await sts.getSessionToken({
    SerialNumber: profileSource.mfaArn,
    TokenCode: profileSource.mfaCode
  }).promise();

  /* === Export temporary credentials back to AWS profile === */
  shell.exec(`aws configure set region ${profileSource.region}  --profile `+profileTarget.name);
  shell.exec(`aws configure set aws_access_key_id ${stsMfaSessions.Credentials.AccessKeyId}  --profile `+profileTarget.name);
  shell.exec(`aws configure set aws_secret_access_key ${stsMfaSessions.Credentials.SecretAccessKey}  --profile `+profileTarget.name);
  shell.exec(`aws configure set aws_session_token ${stsMfaSessions.Credentials.SessionToken}  --profile `+profileTarget.name);

  console.log("Successfully set AWS Profile: "+profileTarget.name);
  console.log("Expires at: "+stsMfaSessions.Credentials.Expiration);
}
main().catch(err => console.error(err));
