# Charter

## Purpose
The purpose of this project is to illustrate how I approach designing and implementing software with the assistance of the latest AI tooling. The project will focus on two aspects: first, highlighting the data modeling techniques required to meet the exercise's requirements; and second demonstrating the practices I use to engineer reliable systems with coding agents. 

The why of the project was left for interpretation. My interpretation is this: we'd want to be able to analyze SBOMs for license information for the reason of detecting and flagging licenses the company may be using improperly. 

An additional, unrelated aim might take a similar approach for surfacing known vulnerabilities. This will be a stretch goal of the project.

## Scope 
The project's runtime requirements should be as simple as feasibly possible. There should be no consideration of production-readiness. The program should be tightly scoped to the requirements stated in the exercise directions (and perhaps the stretch goal if there's time).

## Scale
Questions of scale are theoretical only. We're tasked with considering scaling the system to support ingesting thousands of SBOMs with millions of components. What we build will be concerned with a single SBOM fixture.

## Dreams
Apart from scaling the system, I could imagine a system that answers the questions: 

- Do we have reason to believe a component in the SBOM could be exploited?
- Can we demonstrate that the component is exploitable?
    - What are the signals/signature of this exploit?
- Can we prove that the component was exploited?
- Can we track an application's SBOMs over time and show when a component, or a vulnerable one, was introduced? 