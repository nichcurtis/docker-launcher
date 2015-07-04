# docker-launcher

> Launch docker containers from configurable json files.
>
>   Usage
>
>   -l, --launch              Launch a container. Requires -s flag.
>   -s, --service <string>    Name of service to deploy.
>   -c, --config <string>     Override configuration directory.
>   -v, --volume <string>     Override service configuration value for volume.
>   -q, --silent              Suppress logging
>   --help                    Print usage instructions
> For more information, visit http://docker-launch.22u.io

````

# Install

````shell
npm install -g 22u/docker-launcher
````

# Setup

- create a service configuration in services/ALIAS.json

````js
{
    "name": "wordpress",
    "alias": "wp",
    "version": "0.1.0",

    "container": {
        "volume": false,
        "root"  : false,
        "image" : "wordpress",
        "flags" : [
            "--rm", "-ti", "-p 80:80"
        ],
        "env":    [
            "WORDPRESS_DB_PASSWORD=password"
        ]
    },
    "dependencies": {
        "mysql": {
            "env": [
                "MYSQL_ROOT_PASSWORD=password"
            ],
            "port": "3306:3306",
            "link": "mysql"
        }
    }
}
````

- create a service config for each dependency in containers/dependencies/DEPENDENCY.json

````js
{
    "volume": false,
    "link": "mysql",
    "image": "mysql",
    "flags": [
        "-d"
    ],
    "env":   [
        "MYSQL_ROOT_PASSWORD=password"
    ],
    "ready": [
        {
            "execute" : "mysql",
            "expect"  : "ERROR 1045 (28000): Access denied for user 'root'@'localhost' (using password: NO)"
        }
    ],
    "post": [
        
    ]
}
````

# Usage

- Get docker run command for current dir. Directory name must match the service name or alias.

`dl -l`

- Get docker run command. `-s` must match a service name or alias. Current directory will be mounted to the service container root.

`dl -l -s micro-service`

- Get docker run command, and mount a different folder other than the current working dir.

`dl -l -s micro-service -v /path/to/my/volume`

- Run silently and execute final docker cmd. This will get you directly in a bash session on your service container.

````
$(dl -l -q)
$(dl -l -q -s micro-service)
$(dl -l -q -v /path/to/my/volume)
````

# License

The MIT License (MIT)

Copyright (c) 2015 22u, LLC

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
