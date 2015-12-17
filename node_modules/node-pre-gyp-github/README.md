# node-pre-gyp-github
##### A node-pre-gyp module which provides the ability to publish to GitHub releases instead of Amazon S3 or some other cloud host.

##Usage
Instead of ```node-pre-gyp publish``` use **```node-pre-gyp-github publish```**

## Install
```javascript
npm install -g node-pre-gyp-github
```

## Configuration
This module is intented to be used with node-pre-gyp. Therefore, be sure to configure and install node-pre-gyp first. After having done that, within **```package.json```** update the ```binary``` property ```host``` so it matches the following format:

```
https://github.com/{owner}/{repo}/releases/download/{1.0.1}
```
Be sure to replace ```{owner}```, ```{repo}```, ```{1.0.1}``` with actual values.

***WARNING: Variable substitutions are not supported on the ```host``` property so you will have to manually update the version number with every change.*** Failure to do so will result in users installing the wrong binary versions.

**Tip:** Since the version number will be included within the ```host``` you can ommit it from the package name.

Within GitHub, create a new authorization:

1. go to Settings 
2. click Personal access tokens
3. click Generate new token
4. Select all checkboxes (in a future update I will specify which precise checkboxes are needed, but for now...)
5. Generate Token
6. copy the key that's generated and set NODE_PRE_GYP_GITHUB_TOKEN environment variable to it. Within your command prompt:

```
SET NODE_PRE_GYP_GITHUB_TOKEN=XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
```

## Example
1. node-pre-gyp configure
2. node-pre-gyp build
3. node-pre-gyp package
4. node-pre-gyp-github publish
