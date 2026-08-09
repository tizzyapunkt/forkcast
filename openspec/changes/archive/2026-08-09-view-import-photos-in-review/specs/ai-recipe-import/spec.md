# ai-recipe-import — delta

## ADDED Requirements

### Requirement: Review screen surfaces the source photos for comparison

The frontend AI-import review screen SHALL display the original photos the user submitted for extraction, in the same order they were submitted to the model, so the user can compare the AI-extracted draft against the source while reviewing and editing it. The photos SHALL be shown as a thumbnail strip near the top of the review screen, and tapping a thumbnail SHALL open a fullscreen viewer that pages through all submitted photos in order and can be dismissed back to the review screen without leaving the import flow.

The photos surfaced here are the same in-memory staged photos already held for the duration of the import session; this requirement MUST NOT introduce any persistence of photos, any additional backend call, or any change to the saved recipe. The review screen's image rendering MUST own its own image references derived from the staged photo files, independent of the staging screen's preview lifecycle, so that surfacing the photos at review time does not depend on resources the staging screen may have released.

#### Scenario: Submitted photos shown on the review screen

- **WHEN** a user imports a recipe from three photos and the extracted draft opens on the review screen
- **THEN** the review screen shows three source-photo thumbnails in the submitted order

#### Scenario: Fullscreen view for double-checking

- **WHEN** the user taps a source-photo thumbnail on the review screen
- **THEN** a fullscreen viewer opens on that photo, lets the user page through all submitted photos in order, and can be closed to return to the review screen with any in-progress edits intact

#### Scenario: Surfacing photos persists nothing

- **WHEN** the user reviews a draft with its source photos visible and saves the recipe
- **THEN** the saved recipe carries no photo data and no additional backend call was made to surface the photos
