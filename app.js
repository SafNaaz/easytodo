const express = require('express');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const session = require('express-session')
const passport = require('passport')
const passportLocalMongoose = require('passport-local-mongoose')
const GoogleStrategy = require('passport-google-oauth20').Strategy
//const FacebookStrategy = require('passport-facebook').Strategy
const findOrCreate = require('mongoose-findorcreate')
const LocalStrategy = require('passport-local').Strategy;
//const bcrypt = require('bcrypt-nodejs')

const app = express();

require('dotenv').config()

app.set('view engine', 'ejs')
app.use(bodyParser.urlencoded({ extended: true }))
app.use(express.static('public'))

app.use(session({
    secret: process.env.SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
        maxAge: 1000 * 60 * 60 * 24 * 365
    }
}))

app.use(passport.initialize())
app.use(passport.session())

const uri = process.env.ATLAS_URI_TODO;

mongoose.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true, useFindAndModify: false })

const connection = mongoose.connection;
connection.once('open', () => {
    console.log("MongoDB database connection established successfully");
})

const itemsSchema = mongoose.Schema({
    title: String,
    checked: Boolean
})

const Item = mongoose.model("Item", itemsSchema);

const userItemSchema = mongoose.Schema({
    username: String,
    items: [itemsSchema]

})

const UserItem = mongoose.model('UserItem', userItemSchema)


const userSchema = new mongoose.Schema({
    username: String,
    name: String,
    password: String,
    googleId: String
})



userSchema.plugin(passportLocalMongoose)
userSchema.plugin(findOrCreate)

const User = new mongoose.model('User', userSchema);

passport.use(User.createStrategy())

passport.serializeUser((user, done) => {
    if (user) {
        done(null, user.id)
    }

})

passport.deserializeUser((id, done) => {
    User.findById(id, (err, user) => {
        done(err, user)
    })
})

passport.use(new LocalStrategy(User.authenticate()))

// var validPassword = function (user, password) {
//     return bcrypt.compareSync(user.password, password)
// }
// use this, but dont use passsport local mongoose for saving then
// passport.use(new LocalStrategy(
//     function (username, password, done) {
//         User.findOne({ 'username': username },
//             function (err, user) {
//                 if (err)
//                     return done(err)
//                 if (!user) {
//                     console.log('no user found')
//                     return done(null, false, { message: 'User not found, Please Register' })
//                 }
//                 var authenticate = new User.authenticate();
//                 if (authenticate('username', 'password', (err, result) => {
//                     console.log(result)
//                     if (err) {
//                         console.log(err)


//                     } if (result) {
//                         console.log('incorrect password')
//                         return done(null, false, { message: 'Incorrect Password' })
//                     }
//                 }))
//                     return done(null, user)
//             })
//     }
// ))

passport.use(new GoogleStrategy({
    clientID: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    callbackURL: process.env.REDIRECT_URL
},
    (accessToken, refreshToken, profile, cb) => {
        User.findOne({ username: profile._json.email })
            .then((user, err) => {
                if (err) {
                    console.log(err)
                }
                if (!user) {
                    User.findOrCreate({ username: profile._json.email, googleId: profile.id, name: profile.displayName }, (err, user) => {
                        if (err) {
                            console.log(err)
                        }
                        return cb(err, user)
                    })
                } else {
                    User.findOneAndUpdate({ username: profile._json.email }, { $set: { googleId: profile.id } }, { upsert: true }, (err, user) => {
                        if (err) {
                            console.log(err)
                        }
                        return cb(err, user)
                    })
                }
            })
    }
))

app.get('/', (req, res) => {
    if (req.isAuthenticated()) {
        res.redirect('/notes')
    } else {
        res.render('home');
    }
})

app.get('/notes', (req, res) => {
    if (req.isAuthenticated()) {

        UserItem.findOne({ username: req.user.username })
            .catch((err) => {
                console.log(err)
            }).then(foundItem => {
                if ((foundItem == null) || (foundItem.items == null || foundItem.items.length === 0)) {

                    const item1 = new Item({
                        title: "Welcome to Easy ToDo.. 🤘",
                        checked: false
                    })

                    const item2 = new Item({
                        title: "Type New Item and Hit the ➕ button to add a ToDo",
                        checked: false
                    })

                    const item3 = new Item({
                        title: "Tick the box to mark an item as completed and move to completed section below",
                        checked: false
                    })

                    const item4 = new Item({
                        title: "Hit ❌ button to delete an item",
                        checked: false
                    })

                    const item5 = new Item({
                        title: "Delete all items to see the tips again 😉",
                        checked: false
                    })

                    const item6 = new Item({
                        title: "Remove the tick to move back to ToDo list",
                        checked: true
                    })

                    UserItem.findOneAndUpdate({ username: req.user.username }, {
                        $push: {
                            items: {
                                $each: [item1, item2, item3, item4, item5, item6]
                            }
                        }
                    },
                        { upsert: true }, (err) => {
                            if (err) {
                                console.log(err)
                            } else {
                                res.redirect('/notes')
                            }
                        }
                    )

                } else {
                    res.render("list", { newListItems: foundItem.items, name: req.user.name })
                }
            })
    } else {
        res.redirect('/')
    }
})

app.get('/login', (req, res) => {
    if (req.isAuthenticated()) {
        res.redirect('/notes')
    } else {
        res.render('login', { error: '', username: '' })
    }
})

app.get('/register', (req, res) => {
    if (req.isAuthenticated()) {
        res.redirect('/notes')
    } else {
        res.render('register', { error: '', username: '', name: '' })
    }
})

app.get('/emaillogin', (req, res) => {
    if (req.isAuthenticated()) {
        res.redirect('/notes')
    } else {
        res.render('emaillogin', { error: '', username: '' })
    }
})

app.get('/auth/google',
    passport.authenticate('google', { scope: ['profile', 'email'] }))

// app.get('/auth/google/local',
//     passport.authenticate('google', { failureRedirect: '/login' }),
//     function (req, res) {
//         res.redirect('/notes');
//     });

app.get('/auth/google/easytodo',
    passport.authenticate('google'),
    (err, req, res, next) => {
        if (err) {
            if (err.name === 'TokenError') {
                res.redirect('/auth/google')
            } else if (err.name === 'InternalOAuthError') {
                res.redirect('/auth/google')
            } else {
                console.log(err)
                //     if (err.key && err.keyValue.username) {
                //         var email = encodeURIComponent(err.keyValue.username)
                //     }
                //     res.redirect('/registrationErrorGoogle?email=' + email)
            }
        }
    }, (req, res) => {
        res.redirect('/notes');
    }
)

// app.get('/registrationErrorGoogle', (req, res) => {
//     res.render('login', { error: 'Account with same Email already exists, Please login with Password', name: '', username: req.query.email })
// })

function validate(body) {
    if (body.username === body.password) {
        return 'Username and Password cannot be same'
    } else if (body.password !== body.password1) {
        return 'Please enter same password'
    }

    re = /[0-9]/;
    if (!re.test(body.password)) {
        return 'Password must contain atleast one Number (0-9)!'
    }

    re = /[a-z]/;
    if (!re.test(body.password)) {
        return 'Password must contain atleast one Lower case letter (a-z)!'
    }

    re = /[A-Z]/;
    if (!re.test(body.password)) {
        return 'Password must contain atleast one Upper case letter (A-Z)!'
    }

    return 'true';
}

app.post('/register', (req, res) => {
    let validationError = validate(req.body)
    if (validationError !== 'true') {
        res.render('register', { error: validationError, name: req.body.name, username: req.body.username })
    } else {
        User.register({ username: req.body.username.trim(), name: req.body.name }, req.body.password, (err, user) => {
            if (err) {
                if (err.name === 'UserExistsError') {
                    User.findOne({ username: req.body.username.trim() }, (err, foundUser) => {
                        if (err) {
                            console.log(err)
                        }
                        if (!foundUser.googleId) {
                            res.render('emaillogin', { error: 'User already exists with same Email, Please login with Password.', username: req.body.username })
                        } else {
                            res.render('login', { error: "User already registered via Google, use 'Sign In with Google' option", username: req.body.username })
                        }
                    })

                } else {
                    console.log(err)
                }

            } else {
                //console.log('user' + user)
                passport.authenticate('local')(
                    req, res, () => {
                        res.redirect('/notes')
                    }
                )
            }
        })
    }
})


app.get('/logout', (req, res) => {
    req.logOut()
    res.redirect('/')
})

// app.post('/login', (req, res) => {

//     const user = new User({
//         username: req.body.username,
//         password: req.body.password
//     })

//     req.login(user, (err) => {
//         if (err) {
//             console.log('Login error' + err)

//         } else {
//             passport.authenticate('local', { failureRedirect: '/register' })(
//                 req, res, () => {
//                     res.redirect('/notes')
//                 }
//             )
//         }
//     })

// })

app.post('/login', (req, res) => {

    passport.authenticate('local', (err, user, info) => {
        if (err) {
            console.log(err)
        }
        //console.log('user' + user)
        if (!user) {
            if (info) {
                if (info.name === 'IncorrectPasswordError') {

                    res.render('emaillogin', { error: 'Incorrect Password', name: '', username: req.body.username })
                } else if (info.name === 'IncorrectUsernameError') {
                    res.render('register', { error: "User not found, please 'Sign Up with Google' Or Register using Email", name: '', username: req.body.username })
                } else {
                    User.findOne({ username: req.body.username }, (err, user) => {
                        if (err) {
                            console.log(err)
                        }
                        res.render('login', { error: "Account already registered with Google, Please use the 'Sign in with Google' Option", name: '', username: req.body.username })
                    })
                }
            }
        }

        req.login(user, (err) => {
            if (err) {
                console.log(err)
            }
            res.redirect('/notes')
        })
    })(req, res)
})


// app.post('/notes', (req, res) => {
//     if (req.isAuthenticated()) {
//         const itemTitle = req.body.newItem;

//         const item = new Item({
//             title: itemTitle,
//             checked: false
//         })


//         item.save()
//             .catch((err) => {
//                 console.log(err)
//             }).then(res.redirect('/notes'))
//     } else {
//         res.redirect('/')
//     }
// })

app.post('/notes', (req, res) => {
    if (req.isAuthenticated()) {
        const itemTitle = req.body.newItem;

        UserItem.findOneAndUpdate({ username: req.user.username }, {
            $push: {
                items: {
                    title: itemTitle,
                    checked: false
                }
            }
        },
            { upsert: true }, (err) => {
                if (err) {
                    console.log(err)
                } else {
                    res.redirect('/notes')
                }
            }
        )

    } else {
        res.redirect('/')
    }
})

app.post("/delete", (req, res) => {
    if (req.isAuthenticated()) {
        const deleteItem = req.body.deleteItem;
        UserItem.findOneAndUpdate({ username: req.user.username },
            { $pull: { items: { _id: deleteItem } } }, (err) => {
                if (err)
                    console.log(err)
                res.redirect('/notes')
            })
    } else {
        res.redirect('/')
    }
})

app.post("/deleteAll", (req, res) => {
    if (req.isAuthenticated()) {
        UserItem.findOneAndUpdate({ username: req.user.username },
            { $pull: { items: { checked: true } } }, (err) => {
                if (err)
                    console.log(err)
                res.redirect('/notes')
            })
    } else {
        res.redirect('/')
    }
})

app.post("/update", (req, res) => {
    if (req.isAuthenticated()) {
        let itemId = req.body.itemId;
        let checked = (req.body.checked === 'true')

        UserItem.findOneAndUpdate({ username: req.user.username, items: { $elemMatch: { _id: itemId } } },
            { $set: { 'items.$.checked': !checked } }, (err) => {
                if (err)
                    console.log(err)
                res.redirect('/notes')
            })
    } else {
        res.redirect('/')
    }
})

app.listen(process.env.PORT || 3000, () => {
    console.log("server started in port 3000")
})
