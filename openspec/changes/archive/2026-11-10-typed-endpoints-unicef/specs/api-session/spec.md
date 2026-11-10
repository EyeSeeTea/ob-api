## ADDED Requirements

### Requirement: Choose a location in the session

`api.chooseLocation(locationId)` SHALL request `GET <apiPath>/chooseLocation/{locationId}` through the session (logging in first when necessary). When OpenBoxes accepts it, later automatic logins SHALL use that location. When it fails, the session SHALL keep the location it had.

#### Scenario: Later logins keep the chosen location

- **WHEN** the caller runs `api.chooseLocation("loc-2")` and a later request gets status `401`
- **THEN** the client logs in again with `location` `"loc-2"`

#### Scenario: Failed choice

- **WHEN** `GET …/chooseLocation/loc-2` fails
- **THEN** the request rejects, and later logins use the previous location
