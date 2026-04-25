# 10 - Handle Absent Active Person

## Description
Handle the case where the person whose turn it is to drive or pay is absent. The turn should fairly pass to the next person, and the absent person should not lose their place unfairly.

## Tasks
- Detect when the current driver or payer is marked absent
- Temporarily assign the turn to the next available person
- Decide on a fair policy (e.g. absent person goes next time, or moves to end)
- Display clearly who is covering and why

## Done when
- An absent driver/payer is handled gracefully
- A substitute is selected automatically
- The rotation remains fair for everyone
- The user can see who is covering for whom
