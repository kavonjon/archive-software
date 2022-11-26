# archive software

This software is under development. Please use it at your own risk, as there is no warranty or guarantee that this software will work.

Backup your data! By using this software, you take full responsibility for any data loss that may occur.


## Install

Requires Python 3.8 and invenio-cli

run the following commands:
invenio-cli packages lock
invenio-cli containers build
invenio-cli containers setup -f --no-demo-data
invenio-cli containers start
