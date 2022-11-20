#!/usr/bin/env node
const { SSOClient, ListAccountsCommand, ListAccountRolesCommand, GetRoleCredentialsCommand  } = require("@aws-sdk/client-sso");
const { SSOOIDCClient, RegisterClientCommand, StartDeviceAuthorizationCommand, CreateTokenCommand } = require("@aws-sdk/client-sso-oidc");
const os = require('os');
const inquirer = require('inquirer');
const shell = require('shelljs'); // If typings are not correct in Jetbrains https://github.com/shelljs/shelljs/issues/859#issuecomment-892615449
const open = require('open');

class SSOHelper
{
  startUrl;
  region;
  clientName;
  clientSso;
  clientDevice;

  constructor(startUrl, region, clientName) {
    this.startUrl = startUrl;
    this.region = region;
    this.clientName = clientName;
    this.clientSso = new SSOClient({ region: region });
    this.clientDevice = new SSOOIDCClient({ region: region });
  }

  registerClient = async () => {
    const registerClientCommand = new RegisterClientCommand({clientName: this.clientName, clientType: 'public'})
    return await this.clientDevice.send(registerClientCommand)
  }

  authorizeDevice = async (clientId, clientSecret) => {
    const startDeviceAuthorizationCommand = new StartDeviceAuthorizationCommand({
      clientId: clientId, clientSecret: clientSecret, startUrl: this.startUrl
    })
    const {verificationUri, deviceCode, userCode} = await this.clientDevice.send(startDeviceAuthorizationCommand);

    return {
      verificationUri,
      deviceCode,
      userCode
    };
  }

  getAccessToken = async (clientId, clientSecret, deviceCode, userCode) => {
    const createTokenCommand = new CreateTokenCommand({
      clientId: clientId,
      clientSecret: clientSecret,
      grantType: 'urn:ietf:params:oauth:grant-type:device_code',
      deviceCode: deviceCode,
      code: userCode
    })
    return await this.clientDevice.send(createTokenCommand);
  }

  getAccounts = async (accessToken) => {
    const listAccountsCommand = new ListAccountsCommand({accessToken: accessToken});
    return await this.clientSso.send(listAccountsCommand);
  }

  getAccountRoles = async (accessToken, accountId) => {
    const listAccountRolesCommand = new ListAccountRolesCommand({accessToken: accessToken, accountId: accountId});
    return await this.clientSso.send(listAccountRolesCommand);
  }

  getAccountRoleCredentials = async (accessToken, accountId, roleName) => {
    const getRoleCredentialsCommand = new GetRoleCredentialsCommand({
      accessToken: accessToken, accountId: accountId, roleName: roleName
    });
    const {roleCredentials} = await this.clientSso.send(getRoleCredentialsCommand);
    return roleCredentials;
  }
}

async function main()
{
  /* === Get Inputs from User amd the existing AWS profile === */
  const profilePrompt = await inquirer.prompt([{
    type: 'input',
    name: 'sourceProfile',
    message: 'Source Profile',
  }]);

  const sourceProfileName = profilePrompt.sourceProfile;
  const ssoStartUrl = shell.exec("aws configure get sso_start_url --profile "+sourceProfileName, {silent: true}).stdout.replaceAll(os.EOL, '');
  const ssoRegion = shell.exec("aws configure get sso_region --profile "+sourceProfileName, {silent: true}).stdout.replaceAll(os.EOL, '');
  const ssoAccountId = shell.exec("aws configure get sso_account_id --profile "+sourceProfileName, {silent: true}).stdout.replaceAll(os.EOL, '');
  const ssoRoleName = shell.exec("aws configure get sso_role_name --profile "+sourceProfileName, {silent: true}).stdout.replaceAll(os.EOL, '');
  const region = shell.exec("aws configure get region --profile "+sourceProfileName, {silent: true}).stdout.replaceAll(os.EOL, '');

  const profileSource = {
    name: sourceProfileName,
    ssoStartUrl: ssoStartUrl,
    ssoRegion: ssoRegion,
    ssoAccountId: ssoAccountId,
    ssoRoleName: ssoRoleName,
    region: region,
  };
  const profileTarget = {
    name: profileSource.name+'-temporary',
    ssoSessionName: profileSource.name + "." + ssoRoleName // Can be anything descriptive
  };

  const ssoHelper = new SSOHelper(profileSource.ssoStartUrl, profileSource.ssoRegion, profileTarget.ssoSessionName)
  const {clientId, clientSecret} = await ssoHelper.registerClient();
  if(!clientId || !clientSecret)
    throw new Error("Can not register SSO Client");

  const {deviceCode, userCode, verificationUri} = await ssoHelper.authorizeDevice(clientId, clientSecret);
  if(!deviceCode || !userCode || !verificationUri)
    throw new Error("Can not register SSO Authorized Device");

  const requestUrl = `${verificationUri}?user_code=${userCode}`;
  await open(requestUrl);

  await inquirer.prompt([{
    type: 'input',
    name: 'done',
    message: 'Press enter if you completed the SSO Login and see the "Request Approved" screen.',
  }]);

  let resp = await ssoHelper.getAccessToken(clientId, clientSecret, deviceCode, userCode);
  if(!resp.accessToken || !resp.expiresIn)
    throw new Error("Can not get SSO Access Token");

  const creds = await ssoHelper.getAccountRoleCredentials(resp.accessToken, ssoAccountId, ssoRoleName)
  if(!creds)
    throw new Error("Could not get AWS tokens using the SSO access token");

  /* === Export temporary credentials back to AWS profile === */
  shell.exec(`aws configure set region ${profileSource.region}  --profile `+profileTarget.name);
  shell.exec(`aws configure set aws_access_key_id ${creds.accessKeyId}  --profile `+profileTarget.name);
  shell.exec(`aws configure set aws_secret_access_key ${creds.secretAccessKey}  --profile `+profileTarget.name);
  shell.exec(`aws configure set aws_session_token ${creds.sessionToken}  --profile `+profileTarget.name);

  console.log("Successfully set AWS Profile: "+profileTarget.name);
  console.log("Expires at: "+ (new Date((creds.expiration))));
}
main().catch(err => console.error(err));
