"""
Django project package bootstrap.

Use PyMySQL as a drop-in replacement for MySQLdb (mysqlclient), which can be
problematic to install on Windows due to native DLL dependencies.
"""

import pymysql

pymysql.install_as_MySQLdb()
