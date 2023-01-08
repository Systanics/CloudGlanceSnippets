#!/usr/bin/env node
const shell = require('shelljs'); // If typings are not correct in Jetbrains https://github.com/shelljs/shelljs/issues/859#issuecomment-892615449

function tunnelToArg(tunnel) {
  return ` --parameters "{\\"host\\":[\\"${tunnel.remoteAddress}\\"],\\"portNumber\\":[\\"${tunnel.remotePort}\\"], \\"localPortNumber\\":[\\"${tunnel.localPort}\\"]}"`;
}

async function main()
{
  const src = {
    ec2InstanceId: "your-ec2-instance-id",
    profile: "your-aws-profile",
    tunnels: [
      {
        name: "RDS Dev",
        localPort: 5435,
        remoteAddress: "your-rds.eu-west-1.rds.amazonaws.com",
        remotePort: 5432,
      },
      {
        name: "RDS Dev Proxy",
        localPort: 5436,
        remoteAddress: "your-rds-proxy.eu-west-1.rds.amazonaws.com",
        remotePort: 5432,
      }
    ],
  };

  for(let tunnel of src.tunnels)
  {
    const command = `aws ssm start-session --profile ${src.profile} --target ${src.ec2InstanceId} --document-name AWS-StartPortForwardingSessionToRemoteHost ` + tunnelToArg(tunnel);
    // console.log(command);

    shell.exec(command, {async: true});
    console.log(`> Port forward open, you can access ${tunnel.name} on 'localhost:${tunnel.localPort}'`);
  }
}
main().catch(err => console.error(err));
