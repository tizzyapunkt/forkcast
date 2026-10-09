# Spec Delta

## REMOVED Requirements

### Requirement: Cooked portions of a recipe batch

**Reason**: How much is cooked is decided once per recipe and week, not per batch. The grocery list now
takes portions per recipe as input (`grocery-list`), and the cooking view takes extra portions per
session (`cooking-session`). Neither is stored.

**Migration**: `cookedPortions` is no longer written, returned or copied. Entries persisted with it load
unchanged and the value is ignored. `POST /set-cooked-portions` and the banner control are removed; set
portions in the Einkaufsliste sheet or the cooking view instead.
