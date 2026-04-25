# 14 - Information Page

## Description
A simple page that explains how the WhosTurn system works, so group members can understand the rules without needing to ask.

## Explanation Text

### How Driving Works
The driving rotation is a fixed order between carpool members (Nouk, Levi, Roel). Each week one person drives. After a session is recorded, the turn moves to the next person. After the last person, it loops back to the first.

### How Paying Works
Paying for drinks is tracked with a balance system instead of a fixed rotation. Every member has a balance that starts at 0.

- When someone pays for the group, their balance goes **down by 1**
- Every other member who was present gets their balance increased **by 1**
- Whoever has the **highest balance** (benefited most without paying) is next to pay

This means:
- If you're absent, your balance stays the same — you don't owe anything and nobody paid for you
- If you pay, your balance drops and you won't have to pay again until others catch up
- It's always fair — the person who has been "freeloading" the most is automatically next

### Payment Groups
Members are split into payment groups that track balances independently:
- **Group 1**: Nouk, Levi, Roel, Aliona
- **Group 2**: Peter, Sander

Each group records their own sessions and has their own balances.

### Recording a Session
After climbing, someone opens the app and:
1. Checks who was present (absent members are unchecked)
2. The app suggests who should pay (highest balance among present members)
3. Clicks "Record" to save the session

That's it — the balances update automatically.

## Tasks
- Create a new HTML page (`views/info.html`)
- Add the explanation text above to the page
- Style it with Bootstrap (cards or simple sections)
- Add a link to the info page in the navbar
- Serve the page from a GET `/info` route

## Done when
- The info page is accessible from the navbar
- All explanation text is displayed clearly
- The page is responsive on mobile
