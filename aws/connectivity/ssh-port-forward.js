#!/usr/bin/env node
const shell = require('shelljs'); // If typings are not correct in Jetbrains https://github.com/shelljs/shelljs/issues/859#issuecomment-892615449

function tunnelToArg(tunnel) {
  return ` -L ${tunnel.localPort}:${tunnel.remoteAddress}:${tunnel.remotePort}`
}

async function main()
{
  const src = {
    host: "your-ec2-instance-dns-name-or-ip",
    port: 22,
    cert: "path-to-your-.pem-cert-for-the-instance",
    username: "ec2-user",
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

  let command = [
    `ssh -o StrictHostKeyChecking=no ${src.username}@${src.host} -i "${src.cert}"`,
  ];

  for(let tunnel of src.tunnels)
    command.push(tunnelToArg(tunnel));

  command = command.join(" ");

  // console.log(command);
  shell.exec(command, {async: true});

  for(let tunnel of src.tunnels)
    console.log(`> Port forward open, you can access ${tunnel.name} on 'localhost:${tunnel.localPort}'`);
}
main().catch(err => console.error(err));
