## REMOVED Requirements

### Requirement: Existing user-foods overlay is migrated into the catalog once

**Reason**: This was a one-off migration from the retired user-foods overlay into the catalog. The deployment that held an overlay has already been migrated: its overlay was folded in and deleted. Keeping it around only adds boot-time code and a setting that no data volume needs any more.

**Migration**: None needed for volumes that have booted once since the catalog was introduced. A volume that still holds an unmigrated `user-foods.json` must first boot a release from before this change, which folds the overlay in. After that, it can upgrade.
