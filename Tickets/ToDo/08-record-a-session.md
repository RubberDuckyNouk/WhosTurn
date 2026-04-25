# 08 - Record a Session

## Description
Allow users to log a weekly climbing session. Recording a session advances the driving and payment rotations to the next person.

## Tasks
- Create a `sessions` table to store session records (date, driver, payer)
- Create a POST `/api/sessions` endpoint to record a session
- Add a button to the page to record this week's session
- Advance the driving and payment rotations when a session is recorded
- Show a confirmation after recording

## Done when
- A session can be recorded with one click
- The session is stored with the date, who drove, and who paid
- The driving and payment turns advance to the next person
