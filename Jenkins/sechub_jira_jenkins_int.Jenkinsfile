import groovy.json.JsonSlurperClassic
import groovy.json.JsonOutput

// This is added as label to the task
jiraTeamLabel = 'dummy'

// This ID can be found with Network Tab Opened and click on "Team" dropdown, so you will get all team IDs there.
jiraTeamID = '626'

//This projects is filtering the BlackDuck SCANNER.
projectJenkinsList = [
            'p1',
            'p2'
            ]
//branches from where to fetch the  results
projectJenkinsBranch = [ "develop" ]

pipeline {
    agent{
        kubernetes {
            defaultContainer 'jnlp'
        }
    }
    triggers {
        cron('H 3 * * 1-5')
    }
    environment {
        String projectKey = 'MPC'
        String jiraSite = 'jira'
        String jenkinsUrl = 'https://jenkins-build.com'
    }
    stages {
        stage('Sechub Ticket Creation') {
            steps {
                // withCredentials([string(credentialsId: '', variable: 'JENKINS_TOKEN')]) {
                withCredentials([usernamePassword(
                credentialsId: 'PID828B',
                passwordVariable: 'pass',
                usernameVariable: 'user')]) {
                    script {
                        crumb_token = authenticate()
                        for (project in projectJenkinsList) {
                            for (branch in projectJenkinsBranch) {
                                print "Checking - $branch/$project :P"
                                getSecHubReport(crumb_token, project, branch)
                            }
                        }
                    }
                }
            }
        }
    }
}

def authenticate() {
    final String crumbUrlHeader = "$jenkinsUrl/crumbIssuer/api/xml?xpath=concat(//crumbRequestField,\":\",//crumb)"
    def crumb = sh(script: "curl -X GET --silent --cookie-jar cookie --user \"$user:$pass\" '$crumbUrlHeader'", returnStdout: true).trim()

    return crumb
}

def getSecHubReport(crumb, project, branch) {
    url = "$jenkinsUrl/job/build/job/$project/job/$branch/SecHub-Report/sechub-report.json"
    def res = sh(script: "curl -X GET --silent --cookie cookie --user \"$user:$pass\" $url -H $crumb", returnStdout: true).trim()
    def json = readJSON text: res, returnPojo: true
    // print json['result']
    // print json['result']['findings']
    def severities = filterReport(json)
    createTickets(severities, project, branch)
}

// This method create tickets for all new severities
def createTickets(severities, project, branch) {

    if(severities.isEmpty()) {
        print("No severities with vulnerability HIGH")
        return
    }

    for(int i = 0; i < severities.size(); i++)
    {
        def severity = severities.get(i);
        def ticketTitle = "SECHUB - $branch/$project - $severity.cweId - $severity.severity - $severity.name - $severity.code.calls.relevantPart - $severity.code.location - $severity.code.line:$severity.code.column"
        println(ticketTitle)
        // have to fetch the jira for every iteration because it is possible to the repeated severities
        def searchResults = jiraJqlSearch jql: "project = $projectKey AND summary ~ 'SECHUB'", site: "$jiraSite", fields: ['summary']
        def issues = searchResults.data.issues

        if(hasTicket(issues, ticketTitle))
        {
           print("Already exist a ticket with title: $ticketTitle")
        }
        else
        {
            def sechubDashboard = "$jenkinsUrl/job/build/job/$project/job/$branch//SecHub-Report-Html/"

            //createIssue(ticketTitle, sechubDashboard)
        }
        
    }
}

/*
* CustomField_14600 = Team, 626 = sms-eda (Meaning of jira custom fields)
*/
def void createIssue(ticketTitle, dashboard) {

    // 2 = critical and 3 = major
    def priorityId = "3"

    def newIssue = [fields: [ project: [key: "$projectKey"],
                                summary: ticketTitle,
                                description: "$dashboard",
                                issuetype: [name: 'Task'],
                                priority: [id: "$priorityId"],
                                labels: ["Security", "Sechub", "$jiraTeamLabel"],
                                customfield_14600: "$jiraTeamID"
                                ]]

    response = jiraNewIssue issue: newIssue, site: "$jiraSite"

    print response.successful.toString()
    print response.data.toString()
}

// Filtering notifications by available projects, new vulnerabilities and vulnerabilities are HIGH or CRITICAL
@NonCPS
def filterReport(json) {
    def newList = json.result.findings.findAll { it ->  it.severity == 'HIGH' }
    return newList
}

@NonCPS
def hasTicket(issues, ticketTitle) {
    return issues.any{ it -> it.fields.summary == ticketTitle}
}