# 05 - Add Members

## Description
Allow users to add climbing group members through a form. Each member has a name and a flag indicating whether they participate in the carpool.

## Tasks
- Create a POST `/api/members` endpoint that inserts a new member
- Add a form to the page with fields for name and a carpool checkbox
- Send the form data to the API using JavaScript (fetch)
- Show a success or error message after submitting
- Validate that the name is not empty

## Done when
- A member can be added via the form
- The member is stored in the database
- The form clears after successful submission
- Empty names are rejected
