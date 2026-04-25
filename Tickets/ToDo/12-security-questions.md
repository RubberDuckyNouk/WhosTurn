# 12 - Security Questions

## Description
Protect the app with a rotating security question that must be answered correctly before accessing the site. The questions are inside jokes or things only the climbing group would know. If the answer is wrong, a popup appears with a button that redirects to cv.noukgeelen.nl.

## Questions

### Question 1: "Choose the correct colour for Nouk's grigri and carabiner"
- Show images of grigri's in different colours and carabiners in different colours
- The user clicks one grigri image and one carabiner image to make a combination
- Correct answer: **blue grigri** + **yellow carabiner**

*(More questions can be added later)*

## Tasks
- Create a login/gate page that shows a random security question
- Store a set of questions and answers (e.g. in a config file)
- Rotate which question is shown (random pick each time)
- For the grigri/carabiner question: show clickable colour images for both, let the user pick a combination
- On correct answer, grant access to the app
- On wrong answer, show a popup/modal saying access denied with a button linking to cv.noukgeelen.nl
- Remember the session so the user doesn't have to answer again on every page load
- Add images of grigri's and carabiners in multiple colours to `public/images/`

## Done when
- A security question is shown before the user can access the app
- The question rotates (not always the same one)
- The grigri/carabiner question shows clickable images and checks the combination
- A correct answer lets the user through
- A wrong answer shows a popup with a button to cv.noukgeelen.nl
- The user stays logged in for the session (doesn't have to answer again on refresh)
