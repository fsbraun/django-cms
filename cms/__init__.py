__version__ = '4.0.0dev11'

"""
For version numbering rules see PEP 440 (https://www.python.org/dev/peps/pep-0440/)

Release checklist:
 1.   Ensure that the documentation is up-to-date and contains a release notes file `f"docs/upgrade/{version}.rst"`
 2.   In `setup.py` check that
        - versions from all third party packages are pinned in ``REQUIREMENTS``.
        - the list of ``CLASSIFIERS`` is up to date.
 3.   Releases are created through the "Create a django CMS release" github action:
      https://github.com/django-cms/django-cms/actions/workflows/make-release.yml
 4.   Currently, Mark Walker and Fabian Braun have the right to create releases. To change this, change that line:
      https://github.com/django-cms/django-cms/blob/7e852ec2cc9c1007f482ba22d30caa1f94e2e3cb/.github/workflows/make-release.yml#L16
 5.   The github action needs to be started manually by selecting the "Run workflow" dropdown. It will ask for the
      version number of the release and then runs automatically.
 6.   The script will run the `make-release` script (within the repo's script folder):
 6.1  It updates translations by pulling translations from transifex and compiling them
 6.2  It generates the assets: icons, css, and js bundles
 6.3  It compiles the documentation, creating a `f"docs/upgrade/{version}.rst"` file in the process if needed.
 6.4  It will create an update for the `CHANGELOG.rst` file based on the merged pull requests
 7.   After the update script has been run, the new release is available in the `releases/a.b.x` branch where a and b
      are the main and secondary version numbers.
 8.   Make any needed changes to the `"CHANGELOG.rst"`, ``f"docs/upgrade/{version}.rst"` and commit them to the release
      branch.
 9.   Create a release on github with the version number as tag. When creating the tag the release will be automatically
      uploaded to pypi.
 10.  Merge back the release branch into the develop branch (`develop` or `develop-4` depending on the mayor version
      number.
"""
