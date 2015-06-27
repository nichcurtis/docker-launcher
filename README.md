# docker-launcher

> Launch docker containers from configurable json files.
>
>   Usage
>
>   -l, --launch              Launch a container. Requires -s flag.
>   -s, --service <string>    Name of service to deploy.
>   -v, --volume <string>     Override service configuration value for volume.
>   -q, --silent              Suppress logging
>   --help                    Print usage instructions
> For more information, visit http://docker-launch.22u.io

````

# Install

````shell
npm install
npm link
````

# Setup

- create a service configuration in services/ALIAS.json

````js
{
    "name": "micro-service",
    "alias": "ms", // alias, can be used with -s
    "version": "0.1.0",

    "container": {
        "volume": "$(pwd)", // false if no shared volume, otherwise path to volume
        "root":   "/src", // working dir and volume mapping folder
        "image":  "ubuntu", // docker image
        "flags":  [
            // additional flags to add to the docker run command
            "--rm",
            "-ti"
        ],
        "env":    []
    },
    "dependencies": {
        // containers to load before starting the service container
        // key corresponds to the container alias and file containers/alias.json
        "postgres": {
            // override any of the container configuration settings
            "port": "5432:5432",
            "link": "postgres"
        }
    }
}
````

- create a service config for each dependency in services/containers/DEPENDENCY_ALIAS.json

````js
{
    "volume": false, // false if no shared volume, otherwise path to volume
    "link": "postgres", // alias to use when linking with other containers
    "port": "5432:5432", // port mapping values
    "flags": [
        // additional flags to add to the docker run command
        "-d"
    ],
    "env":   [
        // environment variables to set on the container
        "SQL_USER=postgres",
        "SQL_HOST=postgres"
    ],
    "image": "postgres", // docker image
    "ready": [
        // containers to run after creation, before moving on
        // command must return false if not ready and true if ready
    ],
    "post": [
        // commands to run after in docker container is ready
        "psql -U postgres -c 'CREATE DATABASE my-db'",
    ],
    "after": [
        // commands to run via host cli after container is setup
    ]
}
````

# Usage

- Get docker run command for current dir. Directory name must match the service name or alias. Current directory will be mounted to the service container root.

````shell
dl -l
````

- Get docker run command. `-s` must match a service name or alias. Current directory will be mounted to the service container root.

````shell
dl -l -s micro-service
````

- Get docker run command, and mount a different folder other than the current working dir.

````shell
dl -l -s micro-service -v /path/to/my/volume
````

- Run silently and execute final docker cmd. This will get you directly in a bash session on your service container.

````shell
$(dl -l -q)
$(dl -l -q -s micro-service)
$(dl -l -q -v /path/to/my/volume)
````
