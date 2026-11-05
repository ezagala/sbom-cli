# Charter

## Purpose
This project will focus on two aspects: the first is my approach to system design, which in this case centers on encapsulating responsibilities clearly in distinct components, and on assessing the shape of the data and modeling it appropriately. The second is the practices I use to engineer reliable systems with coding agents. 

The value such a tool might produce was left open to interpretation. My take was this: we'd want to be able to analyze SBOMs for license information to detect and flag licenses the company may be using improperly. 

An additional aim might focus on correlating the components in an SBOM with known vulnerabilities. This will be a stretch goal of the project.

## Scope 
The project's runtime requirements should be as simple as possible. There should be no consideration of production readiness. The program should be tightly scoped to the requirements stated in the exercise directions (and perhaps the stretch goal if there's time).

## Scale
Questions of scale are theoretical only. We're asked to consider how the system would scale to ingest thousands of SBOMs with millions of components. What we build will be concerned with a single SBOM fixture.

## Dreams
Apart from scaling the system, I could imagine a system that answers the questions (increasing in ambition and echoing the stretch goal above): 

- Do we have reason to believe a component in the SBOM could be exploited?
- Can we track an application's SBOMs over time and show when a component, vulnerable or otherwise suspect, was introduced? 
- Can we demonstrate that the component is exploitable?
    - What are the signals or signatures of this exploit?
- Can we prove that the component was exploited?