function onOpen(){
    SpreadsheetApp.getUi().createMenu("Script")
      .addItem("Update Terraform", "generateTfVars")
      .addSeparator()
      .addItem("Update GitHub", "createPullRequest")
      .addToUi();
  }
  
  function generateTfVars() {
  
    var ss = SpreadsheetApp.getActiveSpreadsheet()  
    var squads_sheet = ss.getSheetByName("Squads")
    var squads_values = squads_sheet.getDataRange().getValues()
    var squads_headers = squads_values.shift()
    var squads = {};
  
    for (row of squads_values) {
      var squad = {"members": []}
      for (var i=0; i< squads_headers.length; i++) {
        squad[squads_headers[i]] = row[i]
      }
      squads[squad.id] = squad
    }
  
    var members_sheet = ss.getSheetByName("Members")
    var members_values = members_sheet.getDataRange().getValues()
    var members_headers = members_values.shift()
  
    for (row of members_values) {
      var member = {}
      for (var i=0; i< members_headers.length; i++) {
        member[members_headers[i]] = row[i]
      }
      if(member.squad !== ""){
        squads[member.squad].members.push(member)
      }
    }
  
    // Logger.log(squads)
  
    json_output = { "teams": {} }
  
    for(var id in squads){
      squad = squads[id]
      members = []
      for(member of squad.members.sort((a, b) => (a.email > b.email) ? 1 : -1)){
        members.push({ 
          email : member.email,
          github_username : member.github_username ? member.github_username : null,
          gitlab_username : member.gitlab_username ? member.gitlab_username : null,
          has_slack_account : member.has_slack_account ? member.has_slack_account : false,
          sandbox_project_id : member.sandbox_project_id ? member.sandbox_project_id : null,
        })
      }
  
      if(squad.auto_sync){
        json_output.teams[squad.shortname] = {
          "fullname": squad.fullname,
          "group_id": squad.google_group_id,
          "members": members
        }
      }
    }
  
    json_output.teams["presales"] = {
      "fullname": "Pre-Sales",
      "group_id": null,
      "members": [
        {
          "email": "jules.degironde@devoteamgcloud.com",
          "github_username": null,
          "gitlab_username": null,
          "has_slack_account": true
        },
        {
          "email": "matthieu.audin@devoteamgcloud.com",
          "github_username": "matthieu-audin",
          "gitlab_username": "matthieu.audin",
          "has_slack_account": true
        },
        {
          "email": "nicolas.sarrazy@devoteamgcloud.com",
          "github_username": null,
          "gitlab_username": null,
          "has_slack_account": true
        },
        {
          "email": "julien.deloziere@devoteam.com",
          "github_username": null,
          "gitlab_username": null,
          "has_slack_account": false
        }
      ]
    };
  
  
    ss.getSheetByName("_tf").getRange("A1").setValue([[JSON.stringify(json_output)]])
  
    Logger.log("Done")
  
    // for testing
    return JSON.stringify(json_output)
  }
  
  // for testing
  function createPullRequest() {
    var ACESSTOKEN = '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';
  
    var OWNER = 'devoteamgcloud';
    var REPO = 'dgc-fr-squads-manager';
    var BRANCH = 'develop';
    var FILEPATH = '_teams.auto.tfvars.json';
  
    var APIRULBASE = `https://api.github.com/repos/`;
    
    var newFileContent = generateTfVars();
    Logger.log("Creating branch")
    createBranch(APIRULBASE, OWNER, REPO, BRANCH, ACESSTOKEN);
  
    Logger.log("Committing changes")
    commitChanges(APIRULBASE, OWNER, REPO, BRANCH, FILEPATH, newFileContent, ACESSTOKEN);
  
    Logger.log("Pull request started")
    var pullRequestTitle = 'Update _teams.auto.tfvars.json';
    var pullRequestBody = 'This pull request updates the _teams.auto.tfvars.json.';
    createPullRequestAPI(APIRULBASE, OWNER, REPO, BRANCH, 'main', pullRequestTitle, pullRequestBody, ACESSTOKEN);
  }
  
  function createBranch(baseUrl, owner, repo, branch, accessToken){
    var APIURL = baseUrl + `${owner}/${repo}/git/refs`;
  
    var branchData = {
      ref: `refs/heads/${branch}`,
      sha: getMainBranchSHA(baseUrl, owner, repo, accessToken)
    };
  
    var params = {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + accessToken,
        'Content-Type': 'application/json',
      },
      payload: JSON.stringify(branchData),
    };
  
    UrlFetchApp.fetch(APIURL, params);
    Logger.log("Branch created");
  }
  
  function getMainBranchSHA(baseUrl, owner, repo, accessToken){
    var APIURL = baseUrl + `${owner}/${repo}/git/refs/heads/main`;
  
    var params = {
      method: 'GET',
      headers: {
        Authorization: 'Bearer ' + accessToken,
      },
    };
  
    var response = UrlFetchApp.fetch(APIURL, params);
    var responseData = JSON.parse(response.getContentText());
  
    return responseData.object.sha;
  }
  
  function commitChanges(baseUrl, owner, repo, branch, filePath, fileContent, accessToken){
      var currentFile = UrlFetchApp.fetch(
        baseUrl + `${owner}/${repo}/contents/${filePath}?ref=${branch}`,
        {
          method: 'GET',
          headers: {
            Authorization: 'Bearer ' + accessToken,
          },
        }
      );
    
      if (currentFile.getResponseCode() !== 200) {
        Logger.log('Error fetching current content:', currentFile.getContentText());
        return;
      }
    
      var currentContent = JSON.parse(currentFile.getContentText());
      var currentSha = currentContent.sha;
    
      var commitData = {
        message: 'Update ' + filePath,
        content: Utilities.base64Encode(JSON.stringify(fileContent, null, 2)),
        branch: branch,
        sha: currentSha
      };
    
      var updateParams = {
        method: 'PUT',
        headers: {
          Authorization: 'Bearer ' + accessToken,
          'Content-Type': 'application/json',
        },
        payload: JSON.stringify(commitData),
      };
    
      var updateResponse = UrlFetchApp.fetch(baseUrl + `${owner}/${repo}/contents/${filePath}`, updateParams);
    
      if (updateResponse.getResponseCode() !== 200) {
        Logger.log('Error updating file:', updateResponse.getContentText());
      } else {
        Logger.log('File updated:', updateResponse.getContentText());
      }
  }
  
  function createPullRequestAPI(baseUrl, owner, repo, head, base, title, body, accessToken){
    var APIURL = baseUrl + `${owner}/${repo}/pulls`;
  
    var pullRequestData = {
      title: title,
      body: body,
      head: head,
      base: base,
    };
  
    var params = {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + accessToken,
        'Content-Type': 'application/json',
      },
      payload: JSON.stringify(pullRequestData),
    };
  
    var response = UrlFetchApp.fetch(APIURL, params);
    var responseData = JSON.parse(response.getContentText());
  
    Logger.log('Pull Request Created:', responseData);
  }