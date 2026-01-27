
# WorkFlow-Dashboard
## Flow

- Code is pushed to the GitHub repository
- An auto-generated GitHub Actions workflow is triggered
- Docker image is built
- Docker image is pushed to a container registry
- Deployment step is executed (Not being implemented here)

## Requirements

- Fully automate the CI/CD pipeline using GitHub Actions
- Automatically generate GitHub Actions YAML workflows
- Remove the need for manual YAML writing or maintenance
- Provide an interactive dashboard to manage workflows
- Stream GitHub Actions logs to the dashboard in real time
- Enable one-click actions such as rebuild

## What We Build

- A workflow automator that dynamically generates YAML files for GitHub Actions
- An interactive dashboard to:
  - Trigger and monitor workflows
  - View real-time execution logs
  - Re-run failed jobs or complete workflows
- Docker-based execution for testing and image builds
- Integration with container registry for image push

## Intelligent Agent

- An automated agent that monitors workflow execution status
- Detects failures in GitHub Actions jobs
- Analyzes error logs generated during workflow execution
- Sends detailed failure notifications to Slack
- Attempts automatic resolution for known and recurring errors
- Re-triggers workflows after resolving failures
