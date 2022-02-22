import groovy.json.JsonOutput


// This is added as label to the task
jiraTeamLabel = 'te4am'

// This ID can be found with Network Tab Opened and click on "Team" dropdown, so you will get all team IDs there.
jiraTeamID = '626'

//This projects is filtering the BlackDuck SCANNER.
projectList = [
            'p1',
            'p2',
            'p3'
            ]

pipeline {
    agent{
        kubernetes {
            defaultContainer 'jnlp'
        }
    }
    triggers {
        cron('H 2 * * 1-5')
    }
    environment {
        Date startDate = (new Date() - 1).format("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'")
        String projectKey = 'MPC'
        String jiraSite = 'jira'
    }
    stages {
        stage('BlackDuck Ticket Creation') {
            steps {
                withCredentials([string(credentialsId: 'cicd-blackduck-token', variable: 'BLACKDUCK_TOKEN')]) {
                    script {
                        token = authenticate()
                        notifications = get_bd_notification(token)
                        createTickets(notifications, token);
                    }
                }
            }
        }
    }
}

def authenticate() {
    final String authenticateUrl = "https://bdscan/api/tokens/authenticate"
    def res = sh(script: "curl -X POST $authenticateUrl -H \"Accept: application/vnd.blackducksoftware.user-4+json\" -H \"Authorization: token $BLACKDUCK_TOKEN\" | cut -d '\"' -f 4", returnStdout: true).trim()
    return res
}

def get_bd_notification(token) {
    final String notificationUrl = 'https://bdscan.com/api/users/702dbb22-7cf7-48ad-a7b6-3646cf9af0bc/notifications?limit=1000&offset=0&filter=notificationState%3Anew&filter=notificationState%3Aseen&filter=notificationType%3Avulnerability&startDate=$startDate'
    def res = sh(script: "curl \"$notificationUrl\" -H \"Accept: application/vnd.blackducksoftware.notification-4+json\" -H \"Authorization: Bearer $token\"", returnStdout: true).trim()
    def json = readJSON text: res, returnPojo: true
    def notifications = filterNotifications(json)
    
    return notifications
}

// This method create tickets for all new notifications
def createTickets(notifications, token) {
    
    if(notifications.isEmpty()) {
        println("No notifications with vulnerability HIGH or CRITICAl")
        return
    }
    
    for(int i = 0; i < notifications.size(); i++) 
    {
        def notification = notifications.get(i);
        def content = notification.content
        def affectedProjectVersions = content.affectedProjectVersions[0]
        def ticketTitle = createTitle(content, affectedProjectVersions)
        // have to fetch the jira for every iteration because it is possible to the repeated notifications
        def searchResults = jiraJqlSearch jql: "project = $projectKey AND summary ~ 'BLACKDUCK'", site: "$jiraSite", fields: ['summary']
        def issues = searchResults.data.issues
        
        if(hasTicket(issues, ticketTitle)) 
        {
           println("Already exist a ticket with title: $ticketTitle")
        } 
        else 
        {
             // create map with all vulnerabilities
            def newVulnerabilitiesId = content.newVulnerabilityIds
                                    .findAll { it.severity == 'CRITICAL' || it.severity == 'HIGH' }
                                    .collectEntries{[it.vulnerabilityId, it.vulnerability]}   
                                    
            def isCritical = content.newVulnerabilityIds.any { it.severity == 'CRITICAL'}

            createIssue(ticketTitle, newVulnerabilitiesId, isCritical)
            updateNotificationState(notification, token)
        }
        
    } 
}

/*
* CustomField_14600 = Team, 275 = sms-api-data (Meaning of jira custom fields)
*/
def void createIssue(ticketTitle, vulnerabilitiesIds, isCritical) {

    // 2 = critical and 3 = major
    def priorityId = isCritical ? "2" : "3"

    def newIssue = [fields: [ project: [key: "$projectKey"], 
                                summary: ticketTitle,
                                description: "$vulnerabilitiesIds",
                                issuetype: [name: 'Task'],
                                priority: [id: "$priorityId"],
                                labels: ["Security", "Black-Duck", "$jiraTeamLabel"],
                                customfield_14600: "$jiraTeamID"
                                ]]
                                 

    response = jiraNewIssue issue: newIssue, site: "$jiraSite"

    echo response.successful.toString()
    echo response.data.toString()
}

// This method use the blackduck api to update the ticket notificationState to HIDDEN
def updateNotificationState(notification, token) {

        def content = notification.content;
        def put = [
        	content: content,
        	actionUrl: "$content.componentVersion/vulnerabilities",
        	contentType: "application/json",
        	createdAt: "$notification.createdAt",
        	notificationState: "HIDDEN",
        	type: "$notification.type",
        	_meta: notification._meta
        ]
    
        def output = JsonOutput.toJson(put)
        echo "Updating notification state to HIDDEN: $content.componentName $content.versionName"
     
        // request to update the notificationState to hidden after the ticket is created.      
        sh(script: "curl -X PUT \"$notification._meta.href\" -H \"Content-Type: application/json\" -H \"Authorization: Bearer $token\" -d '$output'", returnStdout: true).trim()
}

// Filtering notifications by available projects, new vulnerabilities and vulnerabilities are HIGH or CRITICAL
@NonCPS
def filterNotifications(json) {

    def newList = json.items.findAll { it ->  

        def content = it.content
        def affectedProjectVersions = content.affectedProjectVersions[0]
        
        // echo "$content.vulnerabilityNotificationCause - $content.componentName $content.versionName affecting $affectedProjectVersions.projectName $affectedProjectVersions.projectVersionName - createdAt: $it.createdAt, - Type: $content.newVulnerabilityIds.severity"
        
        // this returns true or false
       (affectedProjectVersions != null
        && affectedProjectVersions.projectVersionName != null
        && content.vulnerabilityNotificationCause == 'ADDED'
        && isValidBranch(affectedProjectVersions.projectVersionName)
        && isValidProject(affectedProjectVersions.projectName)
        && containsCriticalOrBlocker(content.newVulnerabilityIds))
    
    }
}

@NonCPS
def isValidProject(currentProject) {
    return projectList.any{ it -> it == currentProject}
}

@NonCPS
def containsCriticalOrBlocker(newVulnerabilityIds) {
    return newVulnerabilityIds.any{ it -> it.severity == 'CRITICAL' || it.severity == 'HIGH' }
}

@NonCPS
def hasTicket(issues, ticketTitle) {
    return issues.any{ it -> it.fields.summary == ticketTitle}
}

def createTitle(content, affectedProjectVersions) {
    return "BLACKDUCK - $content.componentName $content.versionName affecting $affectedProjectVersions.projectName $affectedProjectVersions.projectVersionName"
}

@NonCPS
def isValidBranch(branch) {
  return branch.contains('develop') || branch.contains('master')
}
