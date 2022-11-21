# Cloud Glance Code Snippets

This repo houses the code for the "How does Cloud Glance" blog series which explains how Cloud Glance works. Essentially
Cloud Glance has just built a UI on top of these scripts and has some extra bells and whistles.  

## AWS 

### Authentication 

Blog: [How to get AWS credentials(temporary) for IAM User, Role and SSO with scripts]( https://blog.cloudglance.dev/how-does-cloudglance-do-aws-auth/index.html) 

This blog goes through what is required to get temporary AWS credentials for IAM Users, Roles and SSO. 
We show how to configure each method's AWS `.aws/config` and `.aws/credentials` file. So that we can use both the 
AWS CLI or these scripts alongside each other. We will also talk about the AWS CLI equivalent commands and their 
shortcomings. 

These scripts do not handle caching and the AWS IAM User and Role solutions still store long-lived credentials on disk
in plain text. You can also extend the duration longer than 1 hour in certain scenarios.
This is where Cloud Glance makes your life easier:

- :white_check_mark: Don't worry about strange MFA caveats (explained in this article)
- :white_check_mark: Open multiple AWS consoles at the same time with Firefox Containers
- :white_check_mark: Works alongside the AWS CLI and your existing `.aws/credentials` and `.aws/config`
- :white_check_mark: Securely stores long-lived IAM credentials on disk, this encryption is opt-in
- :white_check_mark: Deep bookmark links directly to service resources, ex: Prod CloudWatch Dashboard

There are many more features of CloudGlance including managing Bastion port forwarding and also Tracked Security
Groups that sync your computer IP with the rules in an AWS Security Group. Check it out here: [https://cloudglance.dev/](https://cloudglance.dev/)
