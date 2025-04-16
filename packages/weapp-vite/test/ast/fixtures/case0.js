require
    .async('path/to/mod')
    .then((mod) => {
        console.log(mod)
    })
    .catch(({ errMsg, mod }) => {
        console.error(`path: ${mod}, ${errMsg}`)
    })
